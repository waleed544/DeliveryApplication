import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

const FCM_TOKEN_KEY  = 'bclick_fcm_token';
const HMS_TOKEN_KEY  = 'bclick_hms_token';
// Safety timeout: unblock the app if FCM/HMS never responds within this many ms
const TOKEN_WAIT_TIMEOUT_MS = 8000;

// ─────────────────────────────────────────────────────────────────────────────
// Device-type detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when running on a Huawei device that has HMS Core but no Google
 * Play Services.  On such devices FCM cannot work — we must use HMS Push Kit.
 *
 * Detection strategy (no native plugin required):
 *   • User-agent contains "HUAWEI" or "HONOR"
 *   • AND window.HMSPush is defined (injected by the HMS JS Bridge in WebView)
 *   OR the cached HMS token key already exists in localStorage.
 */
function isHmsDevice() {
  if (!Capacitor.isNativePlatform()) return false;
  const ua = (navigator.userAgent || '').toUpperCase();
  const huaweiUA = ua.includes('HUAWEI') || ua.includes('HONOR');
  const hmsJsBridge = typeof window !== 'undefined' && !!window.HMSPush;
  const cachedHmsToken = !!localStorage.getItem(HMS_TOKEN_KEY);
  return (huaweiUA && hmsJsBridge) || cachedHmsToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a token to the backend.
 * @param {string} token   FCM or HMS token
 * @param {string} provider 'fcm' | 'hms'
 * @param {object} user    authenticated user object
 * @returns {boolean}      true on success
 */
const sendTokenToBackend = async (token, provider, user) => {
  if (!token || !user) return false;
  try {
    await api.post('/notifications/register-token', {
      token,
      provider,
      type: user.role || 'customer',
    });
    console.log(`[Push] ${provider.toUpperCase()} token sent to backend. user=${user.id}`);
    return true;
  } catch (err) {
    console.error(`[Push] Failed to send ${provider} token:`, err?.response?.data || err.message);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HMS token retrieval (JS Bridge approach)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieves the HMS push token via the HMS JS Bridge that Huawei injects into
 * the WebView.  Falls back to a cached token if the bridge is unavailable.
 */
async function getHmsToken() {
  // 1. Try HMS JS Bridge (available when @hmscore/react-native-hms-push or the
  //    Capacitor HMS bridge is used).  We attempt it defensively.
  try {
    if (window.HMSPush && typeof window.HMSPush.getToken === 'function') {
      const result = await window.HMSPush.getToken('');
      if (result && result.result) return result.result;
    }
  } catch (e) {
    console.warn('[HMS] JS Bridge getToken failed:', e.message);
  }

  // 2. Fall back to a token previously stored by HmsMessageService.java via
  //    the Android SharedPreferences → localStorage bridge that some Capacitor
  //    plugins expose.  We read from localStorage as the native service writes
  //    there indirectly via the JSBridge postMessage mechanism.
  const cached = localStorage.getItem(HMS_TOKEN_KEY);
  if (cached) {
    console.log('[HMS] Using cached HMS token from localStorage.');
    return cached;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useAppPermissions
 *
 * Manages push-notification permissions and token registration for both:
 *   - FCM  (Google devices with GMS)
 *   - HMS  (Huawei devices without GMS)
 *
 * Returns { tokenReady } — false until the token is saved to the backend on
 * a new device; true immediately for existing devices and on the web.
 */
export const useAppPermissions = (user) => {
  const setupDone    = useRef(false);
  const userRef      = useRef(user);
  const tokenReadyRef = useRef(false);

  const alreadyCached = Capacitor.isNativePlatform()
    ? !!(localStorage.getItem(FCM_TOKEN_KEY) || localStorage.getItem(HMS_TOKEN_KEY))
    : true;

  const [tokenReady, setTokenReady] = useState(alreadyCached);

  useEffect(() => { userRef.current = user; });

  const markTokenReady = () => {
    if (!tokenReadyRef.current) {
      tokenReadyRef.current = true;
      setTokenReady(true);
      console.log('[Push] tokenReady = true — app unblocked.');
    }
  };

  // ── When user logs in ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    const run = async () => {
      // Safety timeout — never freeze the app
      const safetyTimer = setTimeout(() => {
        console.warn('[Push] Safety timeout — unblocking app.');
        markTokenReady();
      }, TOKEN_WAIT_TIMEOUT_MS);

      const hms = isHmsDevice();

      if (hms) {
        // ── HMS path ───────────────────────────────────────────────────────
        const cached = localStorage.getItem(HMS_TOKEN_KEY);
        if (cached) {
          const ok = await sendTokenToBackend(cached, 'hms', user);
          if (ok) { clearTimeout(safetyTimer); markTokenReady(); return; }
        }
        // Try to get a fresh HMS token
        const freshToken = await getHmsToken();
        if (freshToken) {
          localStorage.setItem(HMS_TOKEN_KEY, freshToken);
          const ok = await sendTokenToBackend(freshToken, 'hms', user);
          if (ok) { clearTimeout(safetyTimer); markTokenReady(); }
        }
        // HMS token will also arrive via HmsMessageService.java onNewToken →
        // stored in localStorage → picked up on next app foreground
      } else {
        // ── FCM path ───────────────────────────────────────────────────────
        const cached = localStorage.getItem(FCM_TOKEN_KEY);
        if (cached) {
          const ok = await sendTokenToBackend(cached, 'fcm', user);
          if (ok) { clearTimeout(safetyTimer); markTokenReady(); }
        }
        // Always re-call register() to refresh token on reinstall / rotation
        setTimeout(async () => {
          try {
            const status = await PushNotifications.checkPermissions();
            if (status.receive === 'granted') {
              await PushNotifications.register();
            } else {
              clearTimeout(safetyTimer);
              markTokenReady();
            }
          } catch (e) {
            console.warn('[FCM] register() on login failed:', e);
            clearTimeout(safetyTimer);
            markTokenReady();
          }
        }, 500);
      }
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── One-time setup on app start ──────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (setupDone.current) return;
    setupDone.current = true;
    requestAllPermissions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAllPermissions = async () => {
    try {
      // 1. Location
      try {
        const locStatus = await Geolocation.checkPermissions();
        if (locStatus.location !== 'granted') await Geolocation.requestPermissions();
      } catch (e) {
        console.warn('[Permissions] Location error:', e);
      }

      // 2. Push notifications
      if (isHmsDevice()) {
        // On HMS devices, HmsMessageService.java handles the token natively.
        // We still request Android notification permission (Android 13+).
        try {
          const result = await PushNotifications.requestPermissions();
          if (result.receive !== 'granted') {
            console.warn('[HMS] Notification permission not granted.');
          }
        } catch (e) {
          console.warn('[HMS] Permission request error:', e);
        }
        // Mark ready — token will arrive via HmsMessageService.java → localStorage
        markTokenReady();
        return;
      }

      // FCM path
      let pushGranted = false;
      try {
        const pushStatus = await PushNotifications.checkPermissions();
        if (pushStatus.receive === 'granted') {
          pushGranted = true;
        } else {
          const result = await PushNotifications.requestPermissions();
          pushGranted = result.receive === 'granted';
        }
      } catch (e) {
        console.warn('[Permissions] Push permission error:', e);
      }

      if (!pushGranted) {
        console.warn('[FCM] Push permissions not granted.');
        markTokenReady();
        return;
      }

      await setupFcmListeners();
    } catch (error) {
      console.error('[Permissions] Unexpected error:', error);
      markTokenReady();
    }
  };

  const setupFcmListeners = async () => {
    try {
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] Token received:', token.value);
        localStorage.setItem(FCM_TOKEN_KEY, token.value);
        const currentUser = userRef.current;
        if (currentUser) {
          const ok = await sendTokenToBackend(token.value, 'fcm', currentUser);
          if (ok) markTokenReady();
        } else {
          console.log('[FCM] No user yet — token cached for after login.');
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] registrationError:', JSON.stringify(err));
        markTokenReady();
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = notification.title || '';
        const body  = notification.body  || '';
        toast(`${title}${body ? '\n' + body : ''}`, { icon: '🔔', duration: 5000 });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Notification tapped:', notification.notification?.title);
      });

      await PushNotifications.register();
      console.log('[FCM] register() called successfully.');
    } catch (error) {
      console.error('[FCM] setupFcmListeners error:', error);
      markTokenReady();
    }
  };

  // ── Expose HMS token to JS from SharedPreferences (written by HmsMessageService.java) ──
  // HmsMessageService writes to Android SharedPreferences "HmsPushPrefs".
  // Capacitor bridges this via a postMessage on startup — we listen for it here.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'HMS_TOKEN' && data.token) {
          console.log('[HMS] Token received from native bridge:', data.token);
          localStorage.setItem(HMS_TOKEN_KEY, data.token);
          const currentUser = userRef.current;
          if (currentUser) {
            sendTokenToBackend(data.token, 'hms', currentUser).then(ok => {
              if (ok) markTokenReady();
            });
          }
        }
      } catch (e) { /* ignore non-JSON messages */ }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tokenReady };
};
