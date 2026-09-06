const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const socketManager = require('./socketManager');

// Keep server alive — log crashes instead of dying silently
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message, err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ─── Socket.IO setup ─────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Authenticate every socket connection via JWT token passed as query param
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
    socket.userId = decoded.id || decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their own personal room so routes can target them directly
  socket.join(`user:${socket.userId}`);
  socket._trackingOrders = new Map();
  console.log(`🔌 Socket connected: user ${socket.userId} (${socket.id})`);

  // ── Real-time location sharing ────────────────────────────────────────────
  // Step 1: Client requests to join an order's tracking room
  socket.on('join_order_tracking', async ({ orderId }) => {
    try {
      const db = require('./config/db');
      const result = await db.query(
        `SELECT o.id,
           cu.id AS customer_user_id,
           du.id AS driver_user_id,
           o.status
         FROM orders o
         JOIN customers c ON o.customer_id = c.id
         JOIN users cu ON c.user_id = cu.id
         LEFT JOIN drivers d ON o.driver_id = d.id
         LEFT JOIN users du ON d.user_id = du.id
         WHERE o.id = $1`,
        [orderId]
      );
      if (!result.rows.length) return;
      const order = result.rows[0];

      // Only allow the customer or driver of this specific order
      const isCustomer = String(order.customer_user_id) === String(socket.userId);
      const isDriver   = order.driver_user_id && String(order.driver_user_id) === String(socket.userId);
      if (!isCustomer && !isDriver) {
        console.warn(`[socket] Unauthorized tracking join: user ${socket.userId} for order ${orderId}`);
        return;
      }

      // Don't allow joining if order is already done
      const inactiveStatuses = ['completed', 'cancelled'];
      if (inactiveStatuses.includes(order.status)) return;

      const room = `order_tracking:${orderId}`;
      socket.join(room);
      const trackingRole = isDriver ? 'driver' : 'customer';
      socket._trackingOrders.set(String(orderId), trackingRole);
      console.log(`📍 ${trackingRole} ${socket.userId} joined tracking room for order ${orderId}`);
    } catch (err) {
      console.error('[socket] join_order_tracking error:', err.message);
    }
  });

  // Step 2: A party sends their GPS coordinates → relay to the other party only
  socket.on('location_update', ({ orderId, latitude, longitude }) => {
    const trackingRole = socket._trackingOrders.get(String(orderId));
    if (!trackingRole) return;
    if (!latitude || !longitude) return;

    const room  = `order_tracking:${orderId}`;
    // The event name tells the receiver who sent it
    const event = trackingRole === 'driver' ? 'driver_location' : 'customer_location';
    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(room).emit(event, { orderId, latitude, longitude, ts: Date.now() });
  });

  // Step 3: Leave the tracking room explicitly
  socket.on('leave_order_tracking', ({ orderId }) => {
    socket.leave(`order_tracking:${orderId}`);
    socket._trackingOrders.delete(String(orderId));
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: user ${socket.userId} (${socket.id})`);
    socket._trackingOrders.clear();
  });
});

// Give all routes access to the io instance via the singleton
socketManager.init(io);

// ─── Express middleware ───────────────────────────────────────────────────────
// Trust first proxy (needed for local dev with React proxy, and any reverse proxy in prod)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 3000,
  skip: (req) => req.path.startsWith('/socket.io') || req.path === '/api/health',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false } // suppress crash when behind React dev proxy
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads — use absolute path so it works regardless of cwd
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/place-options', require('./routes/placeOptions'));
app.use('/api/banners', require('./routes/banners'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Multer error handler (file size / file type rejections)
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الصورة كبير جداً — الحد الأقصى 5 ميجابايت' });
  }
  if (err.message && err.message.includes('المقبولة')) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'حدث خطأ في الخادم', error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await db.query('SELECT 1');
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api`);
      console.log(`🔌 Socket.IO ready`);
    });
  } catch (error) {
    console.error(`❌ Database is not ready: ${error.message}`);
    process.exit(1);
  }
}

startServer();

module.exports = app;
