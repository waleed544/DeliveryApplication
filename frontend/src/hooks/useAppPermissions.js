import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

const FCM_TOKEN_KEY = 'bclick_fcm_token';
// Safety timeout: if FCM never responds within this many ms, unblock the app anyway
const TOKEN_WAIT_TIMEOUT_MS = 8000;

// Send FCM token to backend. Returns true on success, false on failure.
const sendTokenToBackend = async (token, user) => {
  if (!token || !user) return false;
  try {
    await api.post('/notifications/register-token', {
      token,
      type: user.role || 'customer',
    });
    console.log('[FCM] Token sent to backend OK, user:', user.id, 'role:', user.role);
    return true;
  } catch (err) {
    console.error('[FCM] Failed to send token to backend:', err?.response?.data || err.message);
    return false;
  }
};

/**
 * useAppPermissions
 * Returns { tokenReady } — a boolean that is:
 *   - true  immediately on web (no FCM needed)
 *   - true  immediately if this device already has a saved token in localStorage
 *   - false until the FCM token is successfully saved to the backend on a new device
 *   - true  after TOKEN_WAIT_TIMEOUT_MS as a safety fallback so the app never freezes
 */
export const useAppPermissions = (user) => {
  const setupDone = useRef(false);
  const userRef = useRef(user);
  const tokenReadyRef = useRef(false);
  const setTokenReadyRef = useRef(null); // will hold the setter after mount

  // On native: start as false if no cached token yet, true if already cached
  const alreadyCached = Capacitor.isNativePlatform()
    ? !!localStorage.getItem(FCM_TOKEN_KEY)
    : true; // Web never blocks

  const [tokenReady, setTokenReady] = useState(alreadyCached);

  // Keep refs in sync
  useEffect(() => {
    userRef.current = user;
  });
  useEffect(() => {
    setTokenReadyRef.current = setTokenReady;
  }, []);

  const markTokenReady = () => {
    if (!tokenReadyRef.current) {
      tokenReadyRef.current = true;
      setTokenReady(true);
      console.log('[FCM] tokenReady = true — app unblocked.');
    }
  };

  // ── When user logs in: send any cached token and re-trigger register() ────
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    const run = async () => {
      const cached = localStorage.getItem(FCM_TOKEN_KEY);
      if (cached) {
        console.log('[FCM] User logged in, sending cached token to backend...');
        const ok = await sendTokenToBackend(cached, user);
        if (ok) markTokenReady();
      }

      // Safety timeout: unblock the app even if FCM never fires
      const safetyTimer = setTimeout(() => {
        console.warn('[FCM] Safety timeout reached — unblocking app.');
        markTokenReady();
      }, TOKEN_WAIT_TIMEOUT_MS);

      // Always re-call register() to refresh token (handles reinstall / rotation)
      setTimeout(async () => {
        try {
          const status = await PushNotifications.checkPermissions();
          if (status.receive === 'granted') {
            await PushNotifications.register();
            console.log('[FCM] register() called after login to refresh token.');
          } else {
            // Permissions not granted — unblock immediately
            clearTimeout(safetyTimer);
            markTokenReady();
          }
        } catch (e) {
          console.warn('[FCM] register() on login failed:', e);
          clearTimeout(safetyTimer);
          markTokenReady();
        }
      }, 500);
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
        if (locStatus.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (e) {
        console.warn('[Permissions] Location error:', e);
      }

      // 2. Push notifications
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
        // No FCM available — don't block the app, just mark ready
        markTokenReady();
        return;
      }

      await setupPushListeners();
    } catch (error) {
      console.error('[Permissions] Unexpected error:', error);
      markTokenReady(); // fallback — never freeze
    }
  };

  const setupPushListeners = async () => {
    try {
      await PushNotifications.removeAllListeners();

      // CRITICAL: Add listener BEFORE calling register()
      PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] registration event fired, token:', token.value);
        localStorage.setItem(FCM_TOKEN_KEY, token.value);
        const currentUser = userRef.current;
        if (currentUser) {
          const ok = await sendTokenToBackend(token.value, currentUser);
          if (ok) markTokenReady();
        } else {
          console.log('[FCM] No user yet, token cached in localStorage for after login.');
          // Already cached — future login effect will send it
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] registrationError:', JSON.stringify(err));
        markTokenReady(); // error — don't freeze the app
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = notification.title || '';
        const body = notification.body || '';
        toast(`${title}${body ? '\n' + body : ''}`, { icon: '🔔', duration: 5000 });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Notification tapped:', notification.notification?.title);
      });

      await PushNotifications.register();
      console.log('[FCM] register() called successfully.');
    } catch (error) {
      console.error('[FCM] setupPushListeners error:', error);
      markTokenReady(); // error — don't freeze
    }
  };

  return { tokenReady };
};
