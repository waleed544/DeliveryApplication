import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useAppPermissions = (user) => {
  // Track whether we've already set up listeners in this session
  // to avoid stacking duplicate listeners on re-renders
  const listenersSetUp = useRef(false);

  useEffect(() => {
    // Only run natively on Android/iOS, not in web browser
    if (!Capacitor.isNativePlatform()) return;

    requestAllPermissions();

    // Cleanup listeners when component unmounts or user changes
    return () => {
      PushNotifications.removeAllListeners();
      listenersSetUp.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // re-run when the logged-in user changes (login/logout)

  const requestAllPermissions = async () => {
    try {
      // 1. Request Foreground Location Permission
      const locStatus = await Geolocation.checkPermissions();
      if (locStatus.location !== 'granted') {
        const locRequest = await Geolocation.requestPermissions();
        if (locRequest.location !== 'granted') {
          console.warn('Location permission denied gracefully. App continues without it.');
        }
      }

      // 2. Request Push Notification Permission
      const pushStatus = await PushNotifications.checkPermissions();
      if (pushStatus.receive !== 'granted') {
        const pushRequest = await PushNotifications.requestPermissions();
        if (pushRequest.receive !== 'granted') {
          console.warn('Push notification permission denied gracefully.');
          return;
        }
      }

      // 3. Always set up push after reinstall — even if permissions were
      //    already granted, we must re-register to obtain a fresh token
      await setupPushNotifications();

    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const setupPushNotifications = async () => {
    try {
      // Remove any existing listeners before adding new ones to prevent
      // duplicate handlers accumulating across re-renders / reinstalls
      await PushNotifications.removeAllListeners();
      listenersSetUp.current = false;

      // Re-register with FCM — this always yields the current valid token.
      // After a reinstall the OS issues a new token; calling register() fetches it.
      await PushNotifications.register();

      // Only add listeners once per session
      if (listenersSetUp.current) return;
      listenersSetUp.current = true;

      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM token received:', token.value);
        if (!user) return; // Guard: only register if someone is logged in
        try {
          await api.post('/notifications/register-token', {
            token: token.value,
            type: user?.role || 'customer'
          });
          console.log('FCM token registered with backend successfully.');
        } catch (err) {
          console.error('Failed to register FCM token with backend:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // Show in-app toast when the app is foregrounded
        toast(notification.title + (notification.body ? '\n' + notification.body : ''), { icon: '🔔' });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        // User tapped the notification — can route to order details in future
        console.log('Notification tapped:', notification);
      });

    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  };
};
