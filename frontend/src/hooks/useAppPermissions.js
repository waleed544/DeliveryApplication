import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Module-level cache: persists across renders and user login/logout.
// When FCM fires the token while the user is not logged in yet,
// we store it here so we can send it immediately after login.
let _pendingFcmToken = null;

const registerTokenWithBackend = async (token, user) => {
  if (!token || !user) return;
  try {
    await api.post('/notifications/register-token', {
      token,
      type: user?.role || 'customer',
    });
    console.log('[FCM] Token registered with backend for user:', user.id);
  } catch (err) {
    console.error('[FCM] Failed to register token with backend:', err?.response?.data || err.message);
  }
};

export const useAppPermissions = (user) => {
  const setupDone = useRef(false); // ensure push setup runs only once per app session

  // ── Effect 1: User just logged in ───────────────────────────────────────
  // If we already obtained the FCM token before the user logged in,
  // send it to the backend now that we have a valid user object.
  useEffect(() => {
    if (user && _pendingFcmToken) {
      console.log('[FCM] User logged in with a pending token — registering now.');
      registerTokenWithBackend(_pendingFcmToken, user);
      _pendingFcmToken = null; // clear so we don't double-register
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Effect 2: Initial permissions + push setup (runs once) ──────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (setupDone.current) return; // already set up in this session
    setupDone.current = true;

    requestAllPermissions();
    // Note: we intentionally do NOT call removeAllListeners on cleanup here,
    // because the push listeners must survive across route changes and re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAllPermissions = async () => {
    try {
      // 1. Location permission
      const locStatus = await Geolocation.checkPermissions();
      if (locStatus.location !== 'granted') {
        const locRequest = await Geolocation.requestPermissions();
        if (locRequest.location !== 'granted') {
          console.warn('[Permissions] Location denied — app continues without it.');
        }
      }

      // 2. Push notification permission
      const pushStatus = await PushNotifications.checkPermissions();
      if (pushStatus.receive !== 'granted') {
        const pushRequest = await PushNotifications.requestPermissions();
        if (pushRequest.receive !== 'granted') {
          console.warn('[Permissions] Push notifications denied — skipping registration.');
          return;
        }
      }

      // 3. Set up push listeners + register
      await setupPushNotifications();
    } catch (error) {
      console.error('[Permissions] Error during permission setup:', error);
    }
  };

  const setupPushNotifications = async () => {
    try {
      // Clear stale listeners before adding fresh ones
      await PushNotifications.removeAllListeners();

      // ── IMPORTANT: Add listeners BEFORE calling register() ──────────────
      // register() fires the 'registration' event almost synchronously on
      // Android. If we add the listener after, we miss the token entirely.

      PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] Token received:', token.value);

        // Read the current user from the module-level ref approach via
        // the closure captured at setup time. Since setup runs once, we
        // use a trick: try to register immediately; if user isn't available
        // yet (app cold-start before login), cache the token for Effect 1.
        const currentUser = _currentUserRef.current;
        if (currentUser) {
          await registerTokenWithBackend(token.value, currentUser);
        } else {
          console.log('[FCM] No user logged in yet — caching token for after login.');
          _pendingFcmToken = token.value;
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCM] Registration error:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // Foreground notification → show toast
        toast(
          (notification.title || '') + (notification.body ? '\n' + notification.body : ''),
          { icon: '🔔', duration: 5000 }
        );
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Notification tapped:', notification);
      });

      // Now request the token from FCM — fires the 'registration' event above
      await PushNotifications.register();

    } catch (error) {
      console.error('[FCM] Error setting up push notifications:', error);
    }
  };
};

// Module-level ref to always access the latest user inside the one-time listener.
// We keep it as a plain object so the listener closure (set up once) can always
// read the current value without needing re-registration.
export const _currentUserRef = { current: null };
