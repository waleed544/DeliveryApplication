import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

const FCM_TOKEN_KEY = 'bclick_fcm_token';

// Send FCM token to backend - called whenever we have both a token and a logged-in user
const sendTokenToBackend = async (token, user) => {
  if (!token || !user) return;
  try {
    await api.post('/notifications/register-token', {
      token,
      type: user.role || 'customer',
    });
    console.log('[FCM] Token sent to backend OK, user:', user.id, 'role:', user.role);
  } catch (err) {
    console.error('[FCM] Failed to send token to backend:', err?.response?.data || err.message);
  }
};

export const useAppPermissions = (user) => {
  const setupDone = useRef(false);
  const userRef = useRef(user); // always holds the latest user without re-running effects

  // Keep userRef current on every render
  useEffect(() => {
    userRef.current = user;
  });

  // ── When user logs in: send any cached token immediately ─────────────────
  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;
    const cached = localStorage.getItem(FCM_TOKEN_KEY);
    if (cached) {
      console.log('[FCM] User logged in, sending cached token to backend...');
      sendTokenToBackend(cached, user);
    }
    // Also re-trigger register() to get a fresh token (re-fires the event)
    PushNotifications.checkPermissions().then(status => {
      if (status.receive === 'granted') {
        PushNotifications.register().catch(e =>
          console.warn('[FCM] register() re-call failed:', e)
        );
      }
    }).catch(() => {});
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
        return;
      }

      await setupPushListeners();
    } catch (error) {
      console.error('[Permissions] Unexpected error:', error);
    }
  };

  const setupPushListeners = async () => {
    try {
      await PushNotifications.removeAllListeners();

      // CRITICAL: Add the listener BEFORE calling register()
      PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] registration event fired, token:', token.value);
        // Always persist token to localStorage as the most reliable storage
        localStorage.setItem(FCM_TOKEN_KEY, token.value);
        // Send to backend if user is currently logged in
        const currentUser = userRef.current;
        if (currentUser) {
          await sendTokenToBackend(token.value, currentUser);
        } else {
          console.log('[FCM] No user yet, token cached in localStorage for after login.');
        }
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] registrationError:', JSON.stringify(err));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const title = notification.title || '';
        const body = notification.body || '';
        toast(`${title}${body ? '\n' + body : ''}`, { icon: '🔔', duration: 5000 });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Notification tapped:', notification.notification?.title);
      });

      // Fire registration — delivers token to the listener above
      await PushNotifications.register();
      console.log('[FCM] register() called successfully.');
    } catch (error) {
      console.error('[FCM] setupPushListeners error:', error);
    }
  };
};
