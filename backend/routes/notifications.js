const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth'); // Assuming auth middleware exists

// Register Device Token for Push Notifications
router.post('/register-token', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // Determine if the authenticated user is a driver or a customer
    // The existing auth middleware usually sets req.user
    const userId = req.user.role === 'customer' || req.user.type === 'customer' || !req.user.driver_id ? req.user.id : null;
    const driverId = req.user.role === 'driver' || req.user.driver_id ? (req.user.driver_id || req.user.id) : null;
    
    // Check if we need to map based on how the auth system structures req.user
    // Typically in this app:
    // If it's a driver, they log in via driver routes and req.user might have driver-specific fields, or we check the route they came from.
    // Wait, the safest way is if the client passes `{ token, type: 'driver' | 'customer' }` just in case req.user doesn't clearly distinguish.
    
    const type = req.body.type || (req.user.role === 'driver' ? 'driver' : 'customer');
    
    let finalUserId = null;
    let finalDriverId = null;

    if (type === 'customer' || type === 'admin') {
      // Both customers and admins store their token by user_id
      finalUserId = req.user.id;
    } else if (type === 'driver') {
      const driverResult = await pool.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
      if (driverResult.rows.length > 0) {
        finalDriverId = driverResult.rows[0].id;
      } else {
        return res.status(404).json({ message: 'Driver profile not found' });
      }
    }

    if (!finalUserId && !finalDriverId) {
       return res.status(400).json({ message: 'Invalid user type' });
    }

    // Delete any previously registered tokens for this specific user/driver
    // This is critical after reinstall: the OS issues a new FCM token, so the old
    // one in the DB is now invalid. Removing it prevents failed notification attempts.
    if (finalDriverId) {
      await pool.query('DELETE FROM device_tokens WHERE driver_id = $1 AND token != $2', [finalDriverId, token]);
    } else if (finalUserId) {
      await pool.query('DELETE FROM device_tokens WHERE user_id = $1 AND token != $2', [finalUserId, token]);
    }

    // Upsert the new token (handles the case where the same token is re-submitted)
    await pool.query(`
      INSERT INTO device_tokens (user_id, driver_id, token, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (token) DO UPDATE 
      SET user_id = EXCLUDED.user_id, 
          driver_id = EXCLUDED.driver_id,
          updated_at = NOW();
    `, [finalUserId, finalDriverId, token]);

    res.json({ message: 'Token registered successfully' });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
