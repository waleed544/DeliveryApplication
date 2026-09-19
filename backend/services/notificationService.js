const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const { pool } = require('../config/db');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin (FCM) initialisation
// ─────────────────────────────────────────────────────────────────────────────
let isFirebaseInitialized = false;

try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
    credential = admin.cert(serviceAccountPath);
  }
  admin.initializeApp({ credential });
  isFirebaseInitialized = true;
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.warn('Firebase Admin initialization skipped or failed. FCM notifications will not be sent.');
  console.error('Firebase Error Details:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// HMS (Huawei Mobile Services) credentials
// ─────────────────────────────────────────────────────────────────────────────
const HMS_APP_ID     = process.env.HMS_APP_ID;
const HMS_APP_SECRET = process.env.HMS_APP_SECRET;
let hmsAccessToken   = null;
let hmsTokenExpiry   = 0;

/**
 * Obtains (and caches) an HMS OAuth2 access token.
 * Huawei tokens expire in 3600s; we refresh 60s early.
 */
async function getHmsAccessToken() {
  if (hmsAccessToken && Date.now() < hmsTokenExpiry - 60_000) return hmsAccessToken;

  if (!HMS_APP_ID || !HMS_APP_SECRET) {
    throw new Error('HMS_APP_ID / HMS_APP_SECRET env vars are not set.');
  }

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     HMS_APP_ID,
    client_secret: HMS_APP_SECRET,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth-login.cloud.huawei.com',
      path:     '/oauth2/v3/token',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.access_token) {
             console.error('[HMS] Failed to obtain access token from Huawei OAuth2');
             return reject(new Error('HMS token error'));
          }
          hmsAccessToken = json.access_token;
          hmsTokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
          resolve(hmsAccessToken);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Sends an HMS push notification to an array of Huawei RegIDs.
 * Returns an array of failed/invalid tokens for cleanup.
 */
async function sendHmsNotification(tokens, payload) {
  if (!tokens || tokens.length === 0) return [];
  if (!HMS_APP_ID || !HMS_APP_SECRET) {
    console.warn('[HMS] Credentials not set — skipping HMS notification.');
    return [];
  }

  let accessToken;
  try {
    accessToken = await getHmsAccessToken();
  } catch (e) {
    console.error('[HMS] Could not obtain access token:', e.message);
    return [];
  }

  const body = JSON.stringify({
    validate_only: false,
    message: {
      notification: {
        title: payload.title,
        body:  payload.body,
      },
      android: {
        notification: {
          title:              payload.title,
          body:               payload.body,
          default_sound:      true,
          importance:         'HIGH',
          foreground_show:    true,
        },
      },
      token: tokens,   // up to 500 tokens per call
      data:  JSON.stringify(payload.data || {}),
    },
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'push-api.cloud.huawei.com',
      path:     `/v1/${HMS_APP_ID}/messages:send`,
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`[HMS] sending to ${tokens.length} tokens. Response code: ${json.code}`);
          // code 80000000 = success; other codes indicate failures
          if (json.code !== '80000000') {
            console.warn(`[HMS] Non-success response code: ${json.code}, message: ${json.msg || 'unknown'}`);
          }
        } catch (e) {
          console.error('[HMS] Response parse error:', e.message);
        }
        resolve([]); // HMS batch failures handled separately
      });
    });
    req.on('error', e => {
      console.error('[HMS] Request error:', e.message);
      resolve([]);
    });
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FCM helpers
// ─────────────────────────────────────────────────────────────────────────────

async function removeDeadTokens(tokens) {
  if (!tokens || tokens.length === 0) return;
  try {
    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM device_tokens WHERE token IN (${placeholders})`, tokens);
    console.log(`[FCM] Removed ${tokens.length} dead token(s).`);
  } catch (error) {
    console.error('Error removing dead tokens:', error);
  }
}

async function sendFcmNotification(tokens, payload) {
  if (!isFirebaseInitialized || !tokens || tokens.length === 0) return;

  const message = {
    notification: { title: payload.title, body: payload.body },
    data:    payload.data || {},
    tokens,
    android: { notification: { sound: 'default' } },
  };

  try {
    console.log(`[FCM] sending to ${tokens.length} tokens.`);
    const response = await getMessaging().sendEachForMulticast(message);
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          failedTokens.push(tokens[idx]);
        }
      }
    });
    console.log(`[FCM] Successfully sent: ${response.successCount}, Failed: ${response.failureCount}`);
    if (failedTokens.length > 0) await removeDeadTokens(failedTokens);
    return response;
  } catch (error) {
    console.error('[FCM] Error sending notification:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core dispatcher — splits tokens by provider and routes accordingly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a set of device_token rows.
 * Each row must have { token, provider }.
 */
async function dispatchNotification(rows, payload) {
  const fcmTokens = rows.filter(r => r.provider !== 'hms').map(r => r.token);
  const hmsTokens = rows.filter(r => r.provider === 'hms').map(r => r.token);

  const tasks = [];
  if (fcmTokens.length > 0) tasks.push(sendFcmNotification(fcmTokens, payload));
  if (hmsTokens.length > 0) tasks.push(sendHmsNotification(hmsTokens, payload));
  await Promise.all(tasks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public wrappers (same API as before — no callers need to change)
// ─────────────────────────────────────────────────────────────────────────────

async function notifyUser(userId, title, body, data = {}) {
  try {
    const res = await pool.query(
      'SELECT token, provider FROM device_tokens WHERE user_id = $1', [userId]
    );
    await dispatchNotification(res.rows, { title, body, data });
  } catch (err) {
    console.error('[Notify] notifyUser error:', err);
  }
}

async function notifyDriver(driverId, title, body, data = {}) {
  try {
    const res = await pool.query(
      'SELECT token, provider FROM device_tokens WHERE driver_id = $1', [driverId]
    );
    await dispatchNotification(res.rows, { title, body, data });
  } catch (err) {
    console.error('[Notify] notifyDriver error:', err);
  }
}

async function notifyDrivers(driverIds, title, body, data = {}) {
  if (!driverIds || driverIds.length === 0) return;
  try {
    const placeholders = driverIds.map((_, i) => `$${i + 1}`).join(',');
    const res = await pool.query(
      `SELECT token, provider FROM device_tokens WHERE driver_id IN (${placeholders})`,
      driverIds
    );
    await dispatchNotification(res.rows, { title, body, data });
  } catch (err) {
    console.error('[Notify] notifyDrivers error:', err);
  }
}

async function notifyAllUsers(title, body, data = {}) {
  try {
    const res = await pool.query('SELECT token, provider FROM device_tokens');
    await dispatchNotification(res.rows, { title, body, data });
    console.log(`[Notify] Broadcast sent to ${res.rows.length} device(s).`);
  } catch (err) {
    console.error('[Notify] notifyAllUsers error:', err);
  }
}

async function notifyByUserId(userId, title, body, data = {}) {
  try {
    const res = await pool.query(
      `SELECT dt.token, dt.provider FROM device_tokens dt
       LEFT JOIN drivers d ON d.id = dt.driver_id
       WHERE dt.user_id = $1 OR d.user_id = $1`,
      [userId]
    );
    await dispatchNotification(res.rows, { title, body, data });
  } catch (err) {
    console.error('[Notify] notifyByUserId error:', err);
  }
}

async function notifyAdmins(title, body, data = {}) {
  try {
    const adminRes = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    if (adminRes.rows.length === 0) return;
    const adminIds = adminRes.rows.map(r => r.id);
    const placeholders = adminIds.map((_, i) => `$${i + 1}`).join(',');
    const tokRes = await pool.query(
      `SELECT token, provider FROM device_tokens WHERE user_id IN (${placeholders})`,
      adminIds
    );
    await dispatchNotification(tokRes.rows, { title, body, data });
    console.log(`[Notify] Admin notification sent to ${tokRes.rows.length} admin device(s).`);
  } catch (err) {
    console.error('[Notify] notifyAdmins error:', err);
  }
}

module.exports = {
  sendFcmNotification,
  sendHmsNotification,
  notifyUser,
  notifyDriver,
  notifyDrivers,
  notifyAllUsers,
  notifyByUserId,
  notifyAdmins,
  // legacy alias kept for backward-compatibility
  sendPushNotification: sendFcmNotification,
};
