package com.staykids.parent;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import android.util.Base64;

public class StayKidsSyncWorker extends Worker {
    private static final String TAG = "StayKidsSyncWorker";

    public StayKidsSyncWorker(
            @NonNull Context context,
            @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.i(TAG, "Running Background Sync Worker...");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE);
        String urlStr = prefs.getString("syncUrl", null);
        String jwt = prefs.getString("syncJwt", null);
        String hmacSecret = prefs.getString("syncHmacSecret", null);

        if (urlStr == null || jwt == null || hmacSecret == null) {
            Log.e(TAG, "Sync parameters missing. Cannot sync.");
            return Result.failure();
        }

        try {
            // 1. Get Location
            StayKidsLocationService locService = new StayKidsLocationService(context);
            locService.getCurrentLocation(new StayKidsLocationService.LocationCallback() {
                @Override
                public void onSuccess(double lat, double lng) {
                    try {
                        JSONObject payload = new JSONObject();
                        payload.put("type", "update-location");
                        JSONObject coords = new JSONObject();
                        coords.put("lat", lat);
                        coords.put("lng", lng);
                        payload.put("coordinates", coords);

                        sendPostRequest(urlStr, jwt, hmacSecret, payload.toString());
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
                @Override
                public void onError(String error) {
                    Log.e(TAG, "Location error: " + error);
                }
            });

            // 2. Get Call / SMS Logs
            JSONObject logsPayload = new JSONObject();
            logsPayload.put("type", "sync-call-sms-logs");
            JSONObject logs = new JSONObject();
            
            JSONArray callLogs = com.staykids.parent.CallSmsReader.getCallLogs(context);
            JSONArray smsLogs = com.staykids.parent.CallSmsReader.getSmsLogs(context);
            
            logs.put("calls", callLogs);
            logs.put("sms", smsLogs);
            logsPayload.put("logs", logs);

            if (callLogs.length() > 0 || smsLogs.length() > 0) {
                sendPostRequest(urlStr, jwt, hmacSecret, logsPayload.toString());
            }

            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "Background sync failed: " + e.getMessage());
            return Result.retry();
        }
    }

    private void sendPostRequest(String urlStr, String jwt, String hmacSecret, String jsonPayload) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + jwt);

            String timestamp = String.valueOf(System.currentTimeMillis());
            conn.setRequestProperty("X-Request-Timestamp", timestamp);

            // Generate HMAC
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal((jsonPayload + timestamp).getBytes(StandardCharsets.UTF_8));
            
            // Hex encoding
            StringBuilder hexString = new StringBuilder();
            for (byte b : hmacBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            conn.setRequestProperty("X-Request-Signature", hexString.toString());

            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "POST " + urlStr + " responded " + responseCode);
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Failed to POST: " + e.getMessage());
        }
    }
}
