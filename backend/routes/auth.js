const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'defaultsecret';

// Register Customer
router.post('/register/customer', [
  body('phone').notEmpty().withMessage('رقم الهاتف مطلوب'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
  body('name').notEmpty().withMessage('الاسم مطلوب')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.pool.connect();
  try {
    const { phone, password, name, address } = req.body;

    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل — يمكنك تسجيل الدخول' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO users (phone, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [phone, null, hashedPassword, name, 'customer']
    );

    const user = userResult.rows[0];

    await client.query(
      'INSERT INTO customers (user_id, default_address) VALUES ($1, $2)',
      [user.id, address || null]
    );

    await client.query('COMMIT');

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      const detail = (error.detail || error.constraint || '').toLowerCase();
      if (detail.includes('phone')) return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل — يمكنك تسجيل الدخول' });
      if (detail.includes('email')) return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل — جرب بريداً آخر' });
      return res.status(400).json({ message: 'هذه البيانات مسجلة بالفعل' });
    }
    res.status(500).json({ message: 'فشل إنشاء الحساب', error: error.message });
  } finally {
    client.release();
  }
});

// Register Commercial Account
router.post('/register/commercial', [
  body('phone').notEmpty().withMessage('رقم الهاتف مطلوب'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
  body('name').notEmpty().withMessage('الاسم مطلوب'),
  body('business_name').notEmpty().withMessage('اسم النشاط التجاري مطلوب'),
  body('business_location_id').notEmpty().withMessage('يجب تحديد موقع النشاط')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.pool.connect();
  try {
    const { phone, password, name, business_name, business_location_id, business_phone, business_description } = req.body;

    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل — يمكنك تسجيل الدخول' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO users (phone, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [phone, null, hashedPassword, name, 'customer']
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO customers (user_id, account_type, business_name, business_location_id, business_phone, business_description, is_approved_commercial)
       VALUES ($1, 'commercial', $2, $3, $4, $5, false)`,
      [user.id, business_name, business_location_id || null, business_phone || null, business_description || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'تم تسجيل طلبك — سيتم تفعيل حسابك التجاري بعد موافقة المشرف'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل' });
    }
    res.status(500).json({ message: 'فشل إنشاء الحساب', error: error.message });
  } finally {
    client.release();
  }
});

// Register Driver
router.post('/register/driver', [
  body('phone').notEmpty().withMessage('رقم الهاتف مطلوب'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور 6 أحرف على الأقل'),
  body('name').notEmpty().withMessage('الاسم مطلوب'),
  body('vehicle_id').notEmpty().withMessage('نوع المركبة مطلوب')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.pool.connect();
  try {
    const { phone, password, name, vehicle_id, vehicle_plate, national_id, current_location_id } = req.body;

    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل — يمكنك تسجيل الدخول' });
    }

    // Validate that vehicle_id is a real UUID in the vehicles table
    const vehicleCheck = await client.query('SELECT id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleCheck.rows.length === 0) {
      client.release();
      return res.status(400).json({ message: 'نوع المركبة غير صحيح — اختر من القائمة' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      'INSERT INTO users (phone, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [phone, null, hashedPassword, name, 'driver']
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO drivers (user_id, vehicle_id, vehicle_plate, national_id, current_location_id, is_approved)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [user.id, vehicle_id, vehicle_plate || null, national_id || null, current_location_id || null]
    );

    await client.query('COMMIT');

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      message: 'Registration successful. Awaiting admin approval.'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      const detail = (error.detail || error.constraint || '').toLowerCase();
      if (detail.includes('phone')) return res.status(400).json({ message: 'رقم الهاتف مسجل بالفعل — يمكنك تسجيل الدخول' });
      if (detail.includes('email')) return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل — جرب بريداً آخر' });
      return res.status(400).json({ message: 'هذه البيانات مسجلة بالفعل' });
    }
    res.status(500).json({ message: 'فشل إنشاء الحساب', error: error.message });
  } finally {
    client.release();
  }
});

// Login (All roles)
router.post('/login', [
  body('phone').notEmpty().withMessage('Phone required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { phone, password } = req.body;

    const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    // Check driver approval
    if (user.role === 'driver') {
      const driverResult = await db.query('SELECT is_approved FROM drivers WHERE user_id = $1', [user.id]);
      if (driverResult.rows.length > 0 && !driverResult.rows[0].is_approved) {
        return res.status(403).json({ message: 'Driver account pending approval' });
      }
    }

    // Check commercial account approval
    if (user.role === 'customer') {
      const custResult = await db.query('SELECT account_type, is_approved_commercial FROM customers WHERE user_id = $1', [user.id]);
      if (custResult.rows.length > 0 && custResult.rows[0].account_type === 'commercial' && !custResult.rows[0].is_approved_commercial) {
        return res.status(403).json({ message: 'Commercial account pending approval', commercial_pending: true });
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query('SELECT id, name, phone, email, role, avatar_url FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });

    const user = result.rows[0];
    let profile = null;

    if (user.role === 'customer') {
      const cust = await db.query(
        `SELECT c.*, l.name_ar as business_location_name
         FROM customers c
         LEFT JOIN locations l ON c.business_location_id = l.id
         WHERE c.user_id = $1`,
        [user.id]
      );
      profile = cust.rows[0] || null;
    } else if (user.role === 'driver') {
      const drv = await db.query(`SELECT d.*, v.type as vehicle_type, v.name_ar, v.name_en, v.icon 
        FROM drivers d JOIN vehicles v ON d.vehicle_id = v.id WHERE d.user_id = $1`, [user.id]);
      profile = drv.rows[0] || null;
    }

    res.json({ user, profile });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;