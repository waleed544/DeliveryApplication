package com.delivery.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.huawei.hms.push.HmsMessageService;
import com.huawei.hms.push.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * DeliveryHmsService
 *
 * Handles Huawei HMS push events:
 *   - onNewToken:        Receives a fresh HMS push token and registers it with the backend.
 *   - onMessageReceived: Shows a notification when a push arrives while the app is in the background/closed.
 */
public class DeliveryHmsService extends HmsMessageService {

    private static final String TAG              = "HmsMessageService";
    private static final String PREFS_NAME       = "HmsPushPrefs";
    private static final String KEY_HMS_TOKEN    = "hms_token";
    private static final String CHANNEL_ID       = "bclick_default";
    private static final String CHANNEL_NAME     = "بكليك Notifications";

    // ── Backend URL ──────────────────────────────────────────────────────────
    // Must match REACT_APP_API_URL without the trailing /api.
    // The value here is read from BuildConfig if you configure it in Gradle,
    // but for simplicity we read it from the same SharedPreferences that the
    // web-layer writes (key: "bclick_backend_url").  Fallback to the Railway URL.
    private static final String DEFAULT_BACKEND = "https://deliveryapplication-production.up.railway.app";

    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "HMS onNewToken: " + token);

        if (token == null || token.isEmpty()) return;

        // Persist the token so the JS layer can pick it up on next foreground
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String previous = prefs.getString(KEY_HMS_TOKEN, "");
        prefs.edit().putString(KEY_HMS_TOKEN, token).apply();

        // Only register with backend when token actually changed (avoids duplicate calls)
        if (!token.equals(previous)) {
            registerTokenWithBackend(token);
        }
    }

    @Override
    public void onMessageReceived(RemoteMessage message) {
        super.onMessageReceived(message);
        Log.d(TAG, "HMS onMessageReceived: " + message.getData());

        String title = "";
        String body  = "";

        // Try notification payload first
        if (message.getNotification() != null) {
            title = message.getNotification().getTitle();
            body  = message.getNotification().getBody();
        }

        // Fall back to data payload
        if ((title == null || title.isEmpty()) && message.getData() != null) {
            try {
                JSONObject data = new JSONObject(message.getData());
                title = data.optString("title", "بكليك");
                body  = data.optString("body", "");
            } catch (Exception e) {
                Log.w(TAG, "Failed to parse data payload", e);
            }
        }

        if (title != null && !title.isEmpty()) {
            showNotification(title, body != null ? body : "");
        }
    }

    // ── Show local notification ───────────────────────────────────────────────

    private void showNotification(String title, String body) {
        NotificationManager manager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Push notifications from بكليك");
            manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setContentIntent(pendingIntent);

        manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    // ── Register HMS token with backend ───────────────────────────────────────

    private void registerTokenWithBackend(String hmsToken) {
        // Run in a background thread — never block the HMS callback thread
        new Thread(() -> {
            try {
                // Read the JWT auth token written by the React/WebView layer
                SharedPreferences webPrefs = getSharedPreferences("RCTAsyncLocalStorage_V1", Context.MODE_PRIVATE);
                // Capacitor/React stores localStorage in a different location depending on version.
                // We try the most common key names.
                String jwtToken = webPrefs.getString("token", null);

                // Some Capacitor versions use a namespaced key
                if (jwtToken == null) {
                    SharedPreferences altPrefs = getSharedPreferences("WebViewChromiumPrefs", Context.MODE_PRIVATE);
                    jwtToken = altPrefs.getString("token", null);
                }

                if (jwtToken == null || jwtToken.isEmpty()) {
                    // Store the token for JS layer to pick up and send on next launch
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .edit().putString(KEY_HMS_TOKEN, hmsToken).apply();
                    Log.w(TAG, "No JWT token found; HMS push token cached for later registration.");
                    return;
                }

                SharedPreferences hmsPref = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String backendBase = hmsPref.getString("backend_url", DEFAULT_BACKEND);
                String endpoint = backendBase + "/api/notifications/register-token";

                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + jwtToken);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);

                JSONObject payload = new JSONObject();
                payload.put("token",    hmsToken);
                payload.put("provider", "hms");

                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                }

                int status = conn.getResponseCode();
                Log.d(TAG, "HMS token registered with backend. HTTP " + status);
                conn.disconnect();

            } catch (Exception e) {
                Log.e(TAG, "Failed to register HMS token with backend", e);
            }
        }).start();
    }
}
