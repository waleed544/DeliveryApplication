import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useAppPermissions = (user) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    // Only run natively on Android/iOS, not in web browser
    if (Capacitor.isNativePlatform()) {
      requestAllPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const requestAllPermissions = async () => {
    try {
      // 1. Request Foreground Location Permission
      const locStatus = await Geolocation.checkPermissions();
      if (locStatus.location !== 'granted') {
        const locRequest = await Geolocation.requestPermissions();
        if (locRequest.location !== 'granted') {
          console.warn('Location permission denied gracefully. App continues without it.');
          // Do not crash, just continue
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

      // If user is logged in and push is granted, register for push
      if (user) {
        setupPushNotifications();
      }

      setPermissionsGranted(true);
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const setupPushNotifications = async () => {
    try {
      // Register with Apple / Google to receive token via register event
      await PushNotifications.register();

      // Setup Listeners
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        try {
          // Send token to backend
          await api.post('/notifications/register-token', {
            token: token.value,
            type: user?.role || user?.type || 'customer'
          });
        } catch (err) {
          console.error('Failed to register token with backend:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error: ' + JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
        toast(notification.title + '\n' + notification.body, { icon: '🔔' });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ', notification);
        // Could redirect user to order details based on notification.data.orderId
      });

    } catch (error) {
      console.error('Error setting up push notifications:', error);
    }
  };

  return { permissionsGranted };
};
