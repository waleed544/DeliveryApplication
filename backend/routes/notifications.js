const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Register Device Token for Push Notifications (FCM or HMS)
router.post('/register-token', authenticate, async (req, res) => {
  try {
    const { token, provider } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    // provider defaults to 'fcm' for backward-compatibility with existing devices
    const tokenProvider = (provider === 'hms') ? 'hms' : 'fcm';

    const type = req.body.type || (req.user.role === 'driver' ? 'driver' : 'customer');

    let finalUserId = null;
    let finalDriverId = null;

    if (type === 'customer' || type === 'admin') {
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

    // Remove old tokens for this user/driver (keeps only the latest per device)
    if (finalDriverId) {
      await pool.query('DELETE FROM device_tokens WHERE driver_id = $1 AND token != $2', [finalDriverId, token]);
    } else if (finalUserId) {
      await pool.query('DELETE FROM device_tokens WHERE user_id = $1 AND token != $2', [finalUserId, token]);
    }

    // Upsert: insert new token or update provider/owner if token already exists
    await pool.query(`
      INSERT INTO device_tokens (user_id, driver_id, token, provider, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (token) DO UPDATE
      SET user_id    = EXCLUDED.user_id,
          driver_id  = EXCLUDED.driver_id,
          provider   = EXCLUDED.provider,
          updated_at = NOW()
    `, [finalUserId, finalDriverId, token, tokenProvider]);

    res.json({ message: 'Token registered successfully' });
  } catch (error) {
    console.error('Error registering token:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
