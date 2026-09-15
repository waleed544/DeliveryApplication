const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const { pool } = require('../config/db');

// Initialize Firebase Admin using the service account file
let isFirebaseInitialized = false;

try {
  let credential;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Use environment variable in production (Railway)
    const serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.cert(serviceAccountJson);
  } else {
    // Fallback to local file for development
    const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
    credential = admin.cert(serviceAccountPath);
  }

  admin.initializeApp({
    credential: credential,
  });
  
  isFirebaseInitialized = true;
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.warn('Firebase Admin initialization skipped or failed. Notifications will not be sent.');
  console.error('Firebase Error Details:', error.message);
  // Do not crash the app; this allows development/testing even if the user hasn't provided the credentials yet.
}

/**
 * Sends a push notification to specific tokens and handles dead tokens.
 * @param {Array<string>} tokens - Array of FCM tokens
 * @param {Object} payload - { title, body, data }
 */
async function sendPushNotification(tokens, payload) {
  if (!isFirebaseInitialized || !tokens || tokens.length === 0) {
    return;
  }

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    tokens: tokens,
    android: {
      notification: {
        sound: 'default'
      }
    }
  };

  try {
    const response = await getMessaging().sendEachForMulticast(message);
    
    // Check for failed tokens (expired, unregistered, etc.) and remove them from the database
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    if (failedTokens.length > 0) {
      await removeDeadTokens(failedTokens);
    }
    
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Removes invalid tokens from the database.
 */
async function removeDeadTokens(tokens) {
  try {
    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM device_tokens WHERE token IN (${placeholders})`, tokens);
    console.log(`Removed ${tokens.length} dead tokens from database.`);
  } catch (error) {
    console.error('Error removing dead tokens:', error);
  }
}

/**
 * Gets FCM tokens for a specific user (Customer)
 */
async function getUserTokens(userId) {
  try {
    const res = await pool.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.token);
  } catch (err) {
    console.error('Error fetching user tokens:', err);
    return [];
  }
}

/**
 * Gets FCM tokens for a specific driver
 */
async function getDriverTokens(driverId) {
  try {
    const res = await pool.query('SELECT token FROM device_tokens WHERE driver_id = $1', [driverId]);
    return res.rows.map(r => r.token);
  } catch (err) {
    console.error('Error fetching driver tokens:', err);
    return [];
  }
}

/**
 * Wrapper: Notify a user (Customer)
 */
async function notifyUser(userId, title, body, data = {}) {
  const tokens = await getUserTokens(userId);
  if (tokens.length > 0) {
    await sendPushNotification(tokens, { title, body, data });
  }
}

/**
 * Wrapper: Notify a driver
 */
async function notifyDriver(driverId, title, body, data = {}) {
  const tokens = await getDriverTokens(driverId);
  if (tokens.length > 0) {
    await sendPushNotification(tokens, { title, body, data });
  }
}

/**
 * Wrapper: Notify multiple drivers
 */
async function notifyDrivers(driverIds, title, body, data = {}) {
  if (!driverIds || driverIds.length === 0) return;
  try {
    const placeholders = driverIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await pool.query(`SELECT token FROM device_tokens WHERE driver_id IN (${placeholders})`, driverIds);
    const tokens = res.rows.map(r => r.token);
    if (tokens.length > 0) {
      await sendPushNotification(tokens, { title, body, data });
    }
  } catch (err) {
    console.error('Error fetching multiple driver tokens:', err);
  }
}

/**
 * Wrapper: Notify ALL users and drivers (broadcast)
 * Used for site-wide events like new ads or service downtime.
 */
async function notifyAllUsers(title, body, data = {}) {
  try {
    const res = await pool.query('SELECT token FROM device_tokens');
    const tokens = res.rows.map(r => r.token);
    if (tokens.length > 0) {
      await sendPushNotification(tokens, { title, body, data });
      console.log(`[FCM] Broadcast sent to ${tokens.length} devices.`);
    }
  } catch (err) {
    console.error('[FCM] Error broadcasting notification:', err);
  }
}

module.exports = {
  sendPushNotification,
  notifyUser,
  notifyDriver,
  notifyDrivers,
  notifyAllUsers,
};
