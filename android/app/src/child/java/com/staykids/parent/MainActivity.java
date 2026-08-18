package com.staykids.parent;

import android.Manifest;
import androidx.biometric.BiometricPrompt;
import java.util.concurrent.Executor;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.pm.PackageManager;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.core.app.ActivityCompat;
import java.util.Calendar;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "StayKidsMainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StayKidsNativePlugin.class);
        super.onCreate(savedInstanceState);
        Log.i(TAG, "StayKids MainActivity initialized with full Native Plugin Suite.");
    }

    @CapacitorPlugin(
        name = "StayKidsNative",
        permissions = {
            @Permission(
                alias = "camera",
                strings = { Manifest.permission.CAMERA }
            ),
            @Permission(
                alias = "location",
                strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
            ),
            @Permission(
                alias = "microphone",
                strings = { Manifest.permission.RECORD_AUDIO }
            ),
            @Permission(
                alias = "callsms",
                strings = { Manifest.permission.READ_CALL_LOG, Manifest.permission.READ_SMS, Manifest.permission.READ_CONTACTS }
            )
        }
    )
    public static class StayKidsNativePlugin extends Plugin {

        private StayKidsCameraService cameraService;
        private StayKidsLocationService locationService;
        private MediaPlayer sirenPlayer;
        private int previousAlarmVolume = -1;
        private GeofencingClient geofencingClient;
        private BroadcastReceiver geofenceReceiver;

        @Override
        public void load() {
            super.load();
            geofenceReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if ("com.staykids.parent.GEOFENCE_EVENT".equals(intent.getAction())) {
                        String transition = intent.getStringExtra("transition");
                        String geofenceId = intent.getStringExtra("geofenceId");
                        JSObject data = new JSObject();
                        data.put("transition", transition);
                        data.put("geofenceId", geofenceId != null ? geofenceId : "safe_zone_1");
                        notifyListeners("geofence_alert", data);
                    }
                }
            };

            webVisitReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if ("com.staykids.parent.WEB_VISIT_EVENT".equals(intent.getAction())) {
                        String url = intent.getStringExtra("url");
                        JSObject data = new JSObject();
                        data.put("url", url);
                        notifyListeners("web_visit_alert", data);
                    }
                }
            };

            socialNotificationReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if ("com.staykids.parent.NOTIFICATION_POSTED".equals(intent.getAction())) {
                        String notificationData = intent.getStringExtra("notificationData");
                        if (notificationData != null) {
                            try {
                                JSObject data = new JSObject(notificationData);
                                notifyListeners("social_notification_alert", data);
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(geofenceReceiver, new android.content.IntentFilter("com.staykids.parent.GEOFENCE_EVENT"), Context.RECEIVER_NOT_EXPORTED);
                getContext().registerReceiver(webVisitReceiver, new android.content.IntentFilter("com.staykids.parent.WEB_VISIT_EVENT"), Context.RECEIVER_NOT_EXPORTED);
                getContext().registerReceiver(socialNotificationReceiver, new android.content.IntentFilter("com.staykids.parent.NOTIFICATION_POSTED"), Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(geofenceReceiver, new android.content.IntentFilter("com.staykids.parent.GEOFENCE_EVENT"));
                getContext().registerReceiver(webVisitReceiver, new android.content.IntentFilter("com.staykids.parent.WEB_VISIT_EVENT"));
                getContext().registerReceiver(socialNotificationReceiver, new android.content.IntentFilter("com.staykids.parent.NOTIFICATION_POSTED"));
            }
        }

        private BroadcastReceiver webVisitReceiver;
        private BroadcastReceiver socialNotificationReceiver;

        @Override
        protected void handleOnDestroy() {
            super.handleOnDestroy();

            if (sirenPlayer != null) {
                try {
                    if (sirenPlayer.isPlaying()) {
                        sirenPlayer.stop();
                    }
                    sirenPlayer.release();
                    sirenPlayer = null;
                } catch (Exception ignored) {}
            }

            if (geofenceReceiver != null) {
                try {
                    getContext().unregisterReceiver(geofenceReceiver);
                } catch (IllegalArgumentException ignored) {}
            }
            if (webVisitReceiver != null) {
                try {
                    getContext().unregisterReceiver(webVisitReceiver);
                } catch (IllegalArgumentException ignored) {}
            }
            if (socialNotificationReceiver != null) {
                try {
                    getContext().unregisterReceiver(socialNotificationReceiver);
                } catch (IllegalArgumentException ignored) {}
            }
            if (previousAlarmVolume != -1) {
                try {
                    AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                    if (audioManager != null) {
                        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
                    }
                } catch (Exception ignored) {}
                previousAlarmVolume = -1;
            }
        }

        @PluginMethod
        public void authenticateBiometric(PluginCall call) {
            String title = call.getString("title", "StayKids App Lock");
            String subtitle = call.getString("subtitle", "Authenticate to open StayKids Parent App");
            
            getActivity().runOnUiThread(() -> {
                Executor executor = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt biometricPrompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        call.reject("Authentication error: " + errString);
                    }

                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // Optional: do not reject immediately on failure, wait for error or success.
                        // call.reject("Authentication failed"); 
                    }
                });

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setDeviceCredentialAllowed(true)
                        .build();

                biometricPrompt.authenticate(promptInfo);
            });
        }

        private StayKidsCameraService getCameraService() {
            if (cameraService == null) {
                cameraService = new StayKidsCameraService(getContext());
            }
            return cameraService;
        }

        private StayKidsLocationService getLocationService() {
            if (locationService == null) {
                locationService = new StayKidsLocationService(getContext());
            }
            return locationService;
        }

        private GeofencingClient getGeofencingClient() {
            if (geofencingClient == null) {
                geofencingClient = LocationServices.getGeofencingClient(getContext());
            }
            return geofencingClient;
        }

        @PluginMethod
        public void getAppRole(PluginCall call) {
            call.resolve(new JSObject().put("role", BuildConfig.STAYKIDS_ROLE));
        }

        @PluginMethod
        public void startCameraStream(PluginCall call) {
            boolean useFront = call.getBoolean("useFrontCamera", false);
            try {
                StayKidsWebRTCManager.getInstance(getContext()).startCameraWebRTC(useFront);
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                call.reject("Failed to start camera stream", e);
            }
        }

        @PluginMethod
        public void stopCameraStream(PluginCall call) {
            try {
                StayKidsWebRTCManager.getInstance(getContext()).stopWebRTC();
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                call.reject("Failed to stop camera stream", e);
            }
        }

        @PluginMethod
        public void initBackgroundSync(PluginCall call) {
            String url = call.getString("url");
            String jwt = call.getString("jwt");
            String hmacSecret = call.getString("hmacSecret");

            if (url == null || jwt == null || hmacSecret == null) {
                call.reject("Missing required parameters for background sync");
                return;
            }

            android.content.SharedPreferences prefs = getContext().getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("syncUrl", url)
                .putString("syncJwt", jwt)
                .putString("syncHmacSecret", hmacSecret)
                .apply();

            androidx.work.PeriodicWorkRequest syncRequest =
                new androidx.work.PeriodicWorkRequest.Builder(
                    StayKidsSyncWorker.class,
                    15, java.util.concurrent.TimeUnit.MINUTES)
                .build();

            androidx.work.WorkManager.getInstance(getContext())
                .enqueueUniquePeriodicWork(
                    "StayKidsPeriodicSync",
                    androidx.work.ExistingPeriodicWorkPolicy.UPDATE,
                    syncRequest);

            call.resolve(new JSObject().put("success", true));
        }

        @PluginMethod
        public void isAccessibilityEnabled(PluginCall call) {
            boolean enabled = false;
            try {
                int accessibilityEnabled = Settings.Secure.getInt(
                    getContext().getContentResolver(),
                    Settings.Secure.ACCESSIBILITY_ENABLED
                );
                if (accessibilityEnabled == 1) {
                    String service = getContext().getPackageName() + "/" + StayKidsAccessibilityService.class.getName();
                    String settingValue = Settings.Secure.getString(
                        getContext().getContentResolver(),
                        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                    );
                    if (settingValue != null) {
                        enabled = settingValue.toLowerCase().contains(service.toLowerCase());
                    }
                }
            } catch (Exception e) {
                StayKidsAccessibilityService service = StayKidsAccessibilityService.getInstance();
                enabled = (service != null);
            }
            call.resolve(new JSObject().put("enabled", enabled));
        }

        @PluginMethod
        public void openAccessibilitySettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                // Attempt to open the specific service directly on supported OEMs (e.g. Samsung/Xiaomi)
                String componentName = getContext().getPackageName() + "/" + StayKidsAccessibilityService.class.getName();
                intent.putExtra("EXTRA_FRAGMENT_ARG_KEY", componentName);
                Bundle bundle = new Bundle();
                bundle.putString("EXTRA_FRAGMENT_ARG_KEY", componentName);
                intent.putExtra(":settings:show_fragment_args", bundle);
                try {
                    getActivity().startActivity(intent);
                } catch (Exception innerE) {
                    // Fallback to raw intent
                    Intent fallbackIntent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
                    fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(fallbackIntent);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not open Accessibility Settings: " + e.getMessage());
            }
        }

        @PluginMethod
        public void isUsageStatsPermissionGranted(PluginCall call) {
            boolean granted = false;
            try {
                android.app.AppOpsManager appOps = (android.app.AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
                int mode = appOps.checkOpNoThrow(android.app.AppOpsManager.OPSTR_GET_USAGE_STATS, 
                    android.os.Process.myUid(), getContext().getPackageName());
                granted = (mode == android.app.AppOpsManager.MODE_ALLOWED);
            } catch (Exception e) {
                granted = false;
            }
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void openUsageAccessSettings(PluginCall call) {
            try {
                Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                }
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(fallback);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Could not open Usage Access Settings: " + ex.getMessage());
                }
            }
        }

        @PluginMethod
        public void checkNotificationAccess(PluginCall call) {
            boolean granted = false;
            try {
                String pkgName = getContext().getPackageName();
                String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
                if (flat != null && flat.contains(pkgName)) {
                    granted = true;
                }
            } catch (Exception e) {
                granted = false;
            }
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void openNotificationSettings(PluginCall call) {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
                    intent.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, 
                        new ComponentName(getContext(), StayKidsNotificationListener.class).flattenToString());
                } else {
                    intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                    String componentName = new ComponentName(getContext(), StayKidsNotificationListener.class).flattenToString();
                    intent.putExtra("EXTRA_FRAGMENT_ARG_KEY", componentName);
                    Bundle bundle = new Bundle();
                    bundle.putString("EXTRA_FRAGMENT_ARG_KEY", componentName);
                    intent.putExtra(":settings:show_fragment_args", bundle);
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(fallback);
                    call.resolve();
                } catch (Exception ex) {
                    call.reject("Could not open Notification Settings: " + ex.getMessage());
                }
            }
        }

        @PluginMethod
        public void checkCallSmsPermission(PluginCall call) {
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void requestCallSmsPermission(PluginCall call) {
            String[] permissions = {
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_SMS,
                Manifest.permission.READ_CONTACTS
            };
            boolean granted = true;
            for (String perm : permissions) {
                if (ContextCompat.checkSelfPermission(getContext(), perm) != PackageManager.PERMISSION_GRANTED) {
                    granted = false;
                    break;
                }
            }
            if (granted) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                requestPermissionForAlias("callsms", call, "callSmsPermCallback");
            }
        }

        @PermissionCallback
        private void callSmsPermCallback(PluginCall call) {
            if (getPermissionState("callsms") == PermissionState.GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                call.resolve(new JSObject().put("granted", false).put("error", "Permission denied"));
            }
        }
        @PluginMethod
        public void getAppUsageStats(PluginCall call) {
            try {
                android.app.usage.UsageStatsManager usm = (android.app.usage.UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
                if (usm == null) {
                    call.reject("UsageStatsManager not available");
                    return;
                }
                Calendar calendar = Calendar.getInstance();
                long endTime = calendar.getTimeInMillis();
                calendar.set(Calendar.HOUR_OF_DAY, 0);
                calendar.set(Calendar.MINUTE, 0);
                calendar.set(Calendar.SECOND, 0);
                calendar.set(Calendar.MILLISECOND, 0);
                long startTime = calendar.getTimeInMillis();

                java.util.List<android.app.usage.UsageStats> stats = usm.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
                com.getcapacitor.JSArray statsArray = new com.getcapacitor.JSArray();
                
                PackageManager pm = getContext().getPackageManager();

                if (stats != null) {
                    for (android.app.usage.UsageStats stat : stats) {
                        long totalTime = stat.getTotalTimeInForeground();
                        if (totalTime > 60000) { // Only send apps used more than 1 minute
                            JSObject obj = new JSObject();
                            obj.put("packageName", stat.getPackageName());
                            try {
                                android.content.pm.ApplicationInfo info = pm.getApplicationInfo(stat.getPackageName(), 0);
                                obj.put("appName", pm.getApplicationLabel(info).toString());
                            } catch (Exception e) {
                                obj.put("appName", stat.getPackageName());
                            }
                            obj.put("durationMs", totalTime);
                            obj.put("lastUsed", stat.getLastTimeUsed());
                            statsArray.put(obj);
                        }
                    }
                }
                
                call.resolve(new JSObject().put("success", true).put("stats", statsArray));
            } catch (Exception e) {
                call.reject("Failed to query app usage stats: " + e.getMessage());
            }
        }

        @PluginMethod
        public void performRemoteNavigation(PluginCall call) {
            String action = call.getString("action", "HOME");
            StayKidsAccessibilityService service = StayKidsAccessibilityService.getInstance();
            if (service != null) {
                service.performNavigationAction(action);
                call.resolve(new JSObject().put("success", true));
            } else {
                call.reject("Accessibility Service is not currently active.");
            }
        }

        @PluginMethod
        public void getScreenResolution(PluginCall call) {
            try {
                android.util.DisplayMetrics metrics = getContext().getResources().getDisplayMetrics();
                JSObject ret = new JSObject();
                ret.put("screenWidth", metrics.widthPixels);
                ret.put("screenHeight", metrics.heightPixels);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to get screen resolution: " + e.getMessage());
            }
        }

        @PluginMethod
        public void performRemoteTouch(PluginCall call) {
            Double x = call.getDouble("x", 0.0);
            Double y = call.getDouble("y", 0.0);
            StayKidsAccessibilityService service = StayKidsAccessibilityService.getInstance();
            if (service != null) {
                float actualX = x.floatValue();
                float actualY = y.floatValue();
                service.performRemoteTouch(actualX, actualY);
                call.resolve(new JSObject().put("success", true));
            } else {
                call.reject("Accessibility Service is not currently active.");
            }
        }

        @PluginMethod
        public void getInstalledApps(PluginCall call) {
            try {
                android.content.pm.PackageManager pm = getContext().getPackageManager();
                Intent mainIntent = new Intent(Intent.ACTION_MAIN, null);
                mainIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                java.util.List<android.content.pm.ResolveInfo> pkgAppsList = pm.queryIntentActivities(mainIntent, 0);

                com.getcapacitor.JSArray appsArray = new com.getcapacitor.JSArray();
                if (pkgAppsList != null) {
                    for (android.content.pm.ResolveInfo ri : pkgAppsList) {
                        if (ri.activityInfo != null && ri.activityInfo.packageName != null) {
                            String pkgName = ri.activityInfo.packageName;
                            if (!pkgName.startsWith("com.staykids") && !pkgName.startsWith("com.android.settings")) {
                                String appLabel = ri.loadLabel(pm).toString();
                                JSObject appObj = new JSObject();
                                appObj.put("name", appLabel);
                                appObj.put("packageName", pkgName);
                                appObj.put("isBlocked", StayKidsAccessibilityService.isAppBlocked(pkgName));
                                appsArray.put(appObj);
                            }
                        }
                    }
                }
                call.resolve(new JSObject().put("success", true).put("apps", appsArray));
            } catch (Exception e) {
                call.reject("Failed to query installed apps: " + e.getMessage());
            }
        }

        @PluginMethod
        public void getCallSmsLogs(PluginCall call) {
            try {
                com.getcapacitor.JSArray logsArray = new com.getcapacitor.JSArray();
                
                // Fetch Call Logs
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                    android.database.Cursor cursor = getContext().getContentResolver().query(
                        android.provider.CallLog.Calls.CONTENT_URI, null, null, null, android.provider.CallLog.Calls.DATE + " DESC LIMIT 50");
                    if (cursor != null) {
                        try {
                            int numberCol = cursor.getColumnIndex(android.provider.CallLog.Calls.NUMBER);
                            int nameCol = cursor.getColumnIndex(android.provider.CallLog.Calls.CACHED_NAME);
                            int typeCol = cursor.getColumnIndex(android.provider.CallLog.Calls.TYPE);
                            int dateCol = cursor.getColumnIndex(android.provider.CallLog.Calls.DATE);
                            int durCol = cursor.getColumnIndex(android.provider.CallLog.Calls.DURATION);
                            
                            while (cursor.moveToNext()) {
                                JSObject logItem = new JSObject();
                                logItem.put("id", "call_" + cursor.getString(dateCol));
                                logItem.put("logType", "CALL");
                                String contactName = (nameCol >= 0 && cursor.getString(nameCol) != null) ? cursor.getString(nameCol) : (numberCol >= 0 ? cursor.getString(numberCol) : "Unknown");
                                logItem.put("contact", contactName);
                                
                                int type = typeCol >= 0 ? cursor.getInt(typeCol) : -1;
                                String typeStr = type == android.provider.CallLog.Calls.INCOMING_TYPE ? "Incoming" : (type == android.provider.CallLog.Calls.OUTGOING_TYPE ? "Outgoing" : "Missed");
                                logItem.put("detail", typeStr + " (" + (durCol >= 0 ? cursor.getString(durCol) : "0") + "s)");
                                logItem.put("timestamp", cursor.getLong(dateCol));
                                logsArray.put(logItem);
                            }
                        } finally {
                            cursor.close();
                        }
                    }
                }
                
                // Fetch SMS Logs
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
                    android.database.Cursor cursor = getContext().getContentResolver().query(
                        android.provider.Telephony.Sms.CONTENT_URI, null, null, null, android.provider.Telephony.Sms.DATE + " DESC LIMIT 50");
                    if (cursor != null) {
                        try {
                            int addrCol = cursor.getColumnIndex(android.provider.Telephony.Sms.ADDRESS);
                            int bodyCol = cursor.getColumnIndex(android.provider.Telephony.Sms.BODY);
                            int typeCol = cursor.getColumnIndex(android.provider.Telephony.Sms.TYPE);
                            int dateCol = cursor.getColumnIndex(android.provider.Telephony.Sms.DATE);
                            
                            while (cursor.moveToNext()) {
                                JSObject logItem = new JSObject();
                                logItem.put("id", "sms_" + cursor.getString(dateCol));
                                logItem.put("logType", "SMS");
                                String contactAddress = (addrCol >= 0 && cursor.getString(addrCol) != null) ? cursor.getString(addrCol) : "Unknown";
                                logItem.put("contact", contactAddress);
                                
                                int type = typeCol >= 0 ? cursor.getInt(typeCol) : -1;
                                String typeStr = type == android.provider.Telephony.Sms.MESSAGE_TYPE_INBOX ? "Received: " : "Sent: ";
                                String body = bodyCol >= 0 ? cursor.getString(bodyCol) : "";
                                if (body != null && body.length() > 50) body = body.substring(0, 47) + "...";
                                
                                logItem.put("detail", typeStr + body);
                                logItem.put("timestamp", cursor.getLong(dateCol));
                                logsArray.put(logItem);
                            }
                        } finally {
                            cursor.close();
                        }
                    }
                }

                call.resolve(new JSObject().put("success", true).put("logs", logsArray));
            } catch (Exception e) {
                call.reject("Failed to query Call & SMS logs: " + e.getMessage());
            }
        }

        @PluginMethod
        public void getFcmToken(PluginCall call) {
            try {
                com.google.firebase.messaging.FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (!task.isSuccessful()) {
                            JSObject ret = new JSObject();
                            ret.put("success", false);
                            ret.put("error", task.getException() != null ? task.getException().getMessage() : "FCM token fetch failed");
                            call.resolve(ret);
                            return;
                        }
                        String token = task.getResult();
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("token", token);
                        call.resolve(ret);
                    });
            } catch (Throwable t) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "Firebase not initialized: " + t.getMessage());
                call.resolve(ret);
            }
        }

        @PluginMethod
        public void updateWebFilter(PluginCall call) {
            Boolean enabled = call.getBoolean("enabled", false);
            StayKidsAccessibilityService.setWebFilterEnabled(enabled);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }

        @PluginMethod
        public void setDailyLimit(PluginCall call) {
            int limit = call.getInt("limit", -1);
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("StayKidsPrefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putInt("dailyLimit", limit).apply();
            
            android.content.Intent serviceIntent = new android.content.Intent(getContext(), StayKidsUsageService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }

        @PluginMethod
        public void updateBlockedApp(PluginCall call) {
            String packageName = call.getString("packageName");
            Boolean blocked = call.getBoolean("blocked", true);
            if (packageName != null) {
                StayKidsAccessibilityService.setAppBlocked(packageName, blocked != null && blocked);
                call.resolve(new JSObject().put("success", true));
            } else {
                call.reject("Package name is required.");
            }
        }

        // Camera Permission Check & Request
        @PluginMethod
        public void checkCameraPermission(PluginCall call) {
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void requestCameraPermission(PluginCall call) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                requestPermissionForAlias("camera", call, "cameraPermCallback");
            }
        }

        @PermissionCallback
        private void cameraPermCallback(PluginCall call) {
            if (getPermissionState("camera") == PermissionState.GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                call.resolve(new JSObject().put("granted", false).put("error", "Camera permission was denied — enable it in system settings to use surroundings features."));
            }
        }

        @PluginMethod
        public void captureCameraSnapshot(PluginCall call) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("camera", call, "cameraSnapshotPermCallback");
            } else {
                executeCameraSnapshot(call);
            }
        }

        @PermissionCallback
        private void cameraSnapshotPermCallback(PluginCall call) {
            if (getPermissionState("camera") == PermissionState.GRANTED) {
                executeCameraSnapshot(call);
            } else {
                call.resolve(new JSObject()
                    .put("success", false)
                    .put("granted", false)
                    .put("error", "Camera permission was denied — enable it in system settings to capture surroundings photos."));
            }
        }

        private void executeCameraSnapshot(PluginCall call) {
            getCameraService().captureSilentSnapshot(new StayKidsCameraService.SnapshotCallback() {
                @Override
                public void onSuccess(String filePath) {
                    call.resolve(new JSObject().put("success", true).put("granted", true).put("filePath", filePath));
                }

                @Override
                public void onError(String error) {
                    call.resolve(new JSObject().put("success", false).put("error", "Camera snapshot failed: " + error));
                }
            });
        }

        // Location Permission Check & Request
        @PluginMethod
        public void checkLocationPermission(PluginCall call) {
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void requestLocationPermission(PluginCall call) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                requestPermissionForAlias("location", call, "locationPermCallback");
            }
        }

        @PermissionCallback
        private void locationPermCallback(PluginCall call) {
            if (getPermissionState("location") == PermissionState.GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                call.resolve(new JSObject().put("granted", false).put("error", "Location permission was denied — enable it in system settings to use GPS tracking."));
            }
        }

        @PluginMethod
        public void getCurrentLocation(PluginCall call) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("location", call, "locationTrackingPermCallback");
            } else {
                executeLocationTracking(call);
            }
        }

        @PermissionCallback
        private void locationTrackingPermCallback(PluginCall call) {
            if (getPermissionState("location") == PermissionState.GRANTED) {
                executeLocationTracking(call);
            } else {
                call.resolve(new JSObject()
                    .put("success", false)
                    .put("granted", false)
                    .put("error", "Location permission was denied — enable it in system settings for live GPS tracking."));
            }
        }

        private void executeLocationTracking(PluginCall call) {
            getLocationService().getCurrentLocation(new StayKidsLocationService.LocationCallback() {
                @Override
                public void onSuccess(double latitude, double longitude) {
                    call.resolve(new JSObject().put("success", true).put("granted", true).put("latitude", latitude).put("longitude", longitude));
                }

                @Override
                public void onError(String error) {
                    call.resolve(new JSObject().put("success", false).put("error", "Location tracking failed: " + error));
                }
            });
        }

        // Microphone Permission Check & Request
        @PluginMethod
        public void checkMicrophonePermission(PluginCall call) {
            boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void requestMicrophonePermission(PluginCall call) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                requestPermissionForAlias("microphone", call, "microphonePermCallback");
            }
        }

        @PermissionCallback
        private void microphonePermCallback(PluginCall call) {
            if (getPermissionState("microphone") == PermissionState.GRANTED) {
                call.resolve(new JSObject().put("granted", true));
            } else {
                call.resolve(new JSObject().put("granted", false).put("error", "Microphone permission was denied."));
            }
        }

        @PluginMethod
        public void isDeviceAdminEnabled(PluginCall call) {
            DevicePolicyManager dpm = (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName compName = new ComponentName(getContext(), StayKidsDeviceAdminReceiver.class);
            boolean active = dpm != null && dpm.isAdminActive(compName);
            call.resolve(new JSObject().put("enabled", active));
        }

        @PluginMethod
        public void enableDeviceAdmin(PluginCall call) {
            try {
                Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
                ComponentName compName = new ComponentName(getContext(), StayKidsDeviceAdminReceiver.class);
                intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName);
                intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "StayKids anti-uninstall protection prevents unauthorized removal.");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not request Device Admin: " + e.getMessage());
            }
        }

        @PluginMethod
        public void toggleAppIconVisibility(PluginCall call) {
            boolean hide = call.getBoolean("hide", false);
            try {
                PackageManager pm = getContext().getPackageManager();
                ComponentName aliasName = new ComponentName(getContext(), getContext().getPackageName() + ".MainActivityAlias");
                int state = hide 
                    ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED 
                    : PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
                
                pm.setComponentEnabledSetting(aliasName, state, PackageManager.DONT_KILL_APP);
                call.resolve(new JSObject().put("success", true).put("hidden", hide));
            } catch (Exception e) {
                call.reject("Failed to toggle app icon visibility: " + e.getMessage());
            }
        }

        @PluginMethod
        public void isAppIconHidden(PluginCall call) {
            try {
                PackageManager pm = getContext().getPackageManager();
                ComponentName aliasName = new ComponentName(getContext(), getContext().getPackageName() + ".MainActivityAlias");
                int state = pm.getComponentEnabledSetting(aliasName);
                boolean hidden = (state == PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
                call.resolve(new JSObject().put("hidden", hidden));
            } catch (Exception e) {
                call.resolve(new JSObject().put("hidden", false));
            }
        }

        @PluginMethod
        public void isBatteryOptimizationDisabled(PluginCall call) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean isIgnoring = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                isIgnoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            } else {
                isIgnoring = true;
            }
            call.resolve(new JSObject().put("disabled", isIgnoring));
        }

        @PluginMethod
        public void openBatteryOptimizationSettings(PluginCall call) {
            try {
                Intent intent = new Intent();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
            } catch (Exception e) {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(fallback);
            }
            call.resolve();
        }

        @PluginMethod
        public void isOverlayPermissionGranted(PluginCall call) {
            boolean canDraw = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                canDraw = Settings.canDrawOverlays(getContext());
            }
            call.resolve(new JSObject().put("granted", canDraw));
        }

        @PluginMethod
        public void requestOverlayPermission(PluginCall call) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            call.resolve();
        }

        // Real MediaProjection Screen Capture & WebRTC Stream Methods
        @PluginMethod
        public void startScreenShare(PluginCall call) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                android.media.projection.MediaProjectionManager projectionManager =
                    (android.media.projection.MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                if (projectionManager != null) {
                    Intent captureIntent = projectionManager.createScreenCaptureIntent();
                    startActivityForResult(call, captureIntent, "screenCaptureCallback");
                } else {
                    call.reject("MediaProjectionManager service unavailable.");
                }
            } else {
                call.reject("Screen sharing requires Android 5.0 (API 21) or higher.");
            }
        }

        @ActivityCallback
        private void screenCaptureCallback(PluginCall call, androidx.activity.result.ActivityResult result) {
            try {
                if (result.getResultCode() == android.app.Activity.RESULT_OK && result.getData() != null) {
                    Intent serviceIntent = new Intent(getContext(), StayKidsScreenCaptureService.class);
                    serviceIntent.putExtra("resultCode", result.getResultCode());
                    serviceIntent.putExtra("data", result.getData());

                    StayKidsScreenCaptureService.setFrameListener(new StayKidsScreenCaptureService.FrameListener() {
                        @Override
                        public void onFrameAvailable(String base64Jpeg) {
                            JSObject eventData = new JSObject();
                            eventData.put("frame", base64Jpeg);
                            notifyListeners("screenFrame", eventData);
                        }
                    });

                    StayKidsWebRTCManager.getInstance(getContext()).setSignalListener(new StayKidsWebRTCManager.WebRTCSignalListener() {
                        @Override
                        public void sendSignal(org.json.JSONObject signalData) {
                            try {
                                JSObject eventData = new JSObject();
                                if (signalData.has("answer")) {
                                    eventData.put("answer", signalData.getJSONObject("answer"));
                                }
                                if (signalData.has("candidate")) {
                                    eventData.put("candidate", signalData.getJSONObject("candidate"));
                                }
                                if (signalData.has("signalState")) {
                                    eventData.put("signalState", signalData.getString("signalState"));
                                }
                                notifyListeners("webrtcSignal", eventData);
                            } catch (Exception e) {
                                Log.e("MainActivity", "Error sending WebRTC signal event: " + e.getMessage());
                            }
                        }
                    });

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(serviceIntent);
                    } else {
                        getContext().startService(serviceIntent);
                    }

                    // Fix 1: Actually start WebRTC screen capture session on consent grant!
                    try {
                        StayKidsWebRTCManager.getInstance(getContext()).startScreenCaptureWebRTC(result.getData(), new android.media.projection.MediaProjection.Callback() {
                            @Override
                            public void onStop() {
                                try {
                                    StayKidsWebRTCManager.getInstance(getContext()).stopWebRTC();
                                } catch (Exception ignored) {}
                            }
                        });
                    } catch (Exception e) {
                        Log.w("MainActivity", "WebRTC startScreenCaptureWebRTC initialization warning: " + e.getMessage());
                    }

                    call.resolve(new JSObject()
                        .put("success", true)
                        .put("streaming", true)
                        .put("message", "Screen capture consent granted. MediaProjection WebRTC stream active."));
                } else {
                    call.resolve(new JSObject()
                        .put("success", false)
                        .put("streaming", false)
                        .put("error", "Screen recording consent was denied by user on child device."));
                }
            } catch (Exception e) {
                call.reject("Screen capture service initialization failed: " + e.getMessage());
            }
        }

        @PluginMethod
        public void stopScreenShare(PluginCall call) {
            try {
                Intent stopIntent = new Intent(getContext(), StayKidsScreenCaptureService.class);
                getContext().stopService(stopIntent);
                try {
                    StayKidsWebRTCManager.getInstance(getContext()).stopWebRTC();
                } catch (Exception ignored) {}
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to stop screen share: " + e.getMessage());
            }
        }

        @PluginMethod
        public void handleWebRTCSignal(PluginCall call) {
            try {
                JSObject data = call.getData();
                if (data != null) {
                    StayKidsWebRTCManager manager = StayKidsWebRTCManager.getInstance(getContext());
                    if (data.has("offer")) {
                        org.json.JSONObject offerObj = data.getJSObject("offer");
                        if (offerObj != null) {
                            manager.handleIncomingOffer(offerObj);
                        }
                    }
                    if (data.has("candidates")) {
                        org.json.JSONArray candArray = data.getJSONArray("candidates");
                        if (candArray != null) {
                            manager.handleIncomingCandidates(candArray);
                        }
                    }
                }
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                call.reject("Failed to handle WebRTC signal: " + e.getMessage());
            }
        }

        @PluginMethod
        public void isScreenSharingActive(PluginCall call) {
            try {
                boolean active = StayKidsScreenCaptureService.isStreaming();
                call.resolve(new JSObject().put("active", active));
            } catch (Exception e) {
                call.resolve(new JSObject().put("active", false));
            }
        }

        // Real Surroundings One-Way Audio Methods
        @PluginMethod
        public void startAudioCapture(PluginCall call) {
            try {
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    StayKidsAudioService.setAudioChunkListener(new StayKidsAudioService.AudioChunkListener() {
                        @Override
                        public void onAudioChunkAvailable(String base64Wav) {
                            JSObject eventData = new JSObject();
                            eventData.put("chunk", base64Wav);
                            notifyListeners("audioChunk", eventData);
                        }
                    });

                    Intent serviceIntent = new Intent(getContext(), StayKidsAudioService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(serviceIntent);
                    } else {
                        getContext().startService(serviceIntent);
                    }
                    call.resolve(new JSObject().put("success", true).put("capturing", true));
                } else {
                    call.reject("RECORD_AUDIO permission is required.");
                }
            } catch (Exception e) {
                call.reject("Failed to start audio service: " + e.getMessage());
            }
        }

        @PluginMethod
        public void stopAudioCapture(PluginCall call) {
            try {
                Intent stopIntent = new Intent(getContext(), StayKidsAudioService.class);
                getContext().stopService(stopIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to stop audio: " + e.getMessage());
            }
        }

        @PluginMethod
        public void isAudioCapturing(PluginCall call) {
            try {
                boolean capturing = StayKidsAudioService.isAudioCapturing();
                call.resolve(new JSObject().put("capturing", capturing));
            } catch (Exception e) {
                call.resolve(new JSObject().put("capturing", false));
            }
        }

        @PluginMethod
        public void startLiveCamera(PluginCall call) {
            String facing = call.getString("facing", "environment");
            final java.util.concurrent.atomic.AtomicBoolean resolved = new java.util.concurrent.atomic.AtomicBoolean(false);
            getCameraService().startLiveStream(facing, new StayKidsCameraService.LiveFrameCallback() {
                @Override
                public void onStarted() {
                    if (resolved.compareAndSet(false, true)) {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("streaming", true);
                        call.resolve(ret);
                    }
                }

                @Override
                public void onFrame(byte[] jpegData) {
                    if (resolved.compareAndSet(false, true)) {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("streaming", true);
                        call.resolve(ret);
                    }
                    String base64 = android.util.Base64.encodeToString(jpegData, android.util.Base64.NO_WRAP);
                    JSObject frameEvent = new JSObject();
                    frameEvent.put("frame", "data:image/jpeg;base64," + base64);
                    notifyListeners("cameraFrame", frameEvent);
                }

                @Override
                public void onError(String error) {
                    if (resolved.compareAndSet(false, true)) {
                        call.reject(error);
                    }
                }
            });
        }

        @PluginMethod
        public void stopLiveCamera(PluginCall call) {
            getCameraService().stopLiveStream();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }

        @PluginMethod
        public void isLiveCameraActive(PluginCall call) {
            JSObject ret = new JSObject();
            ret.put("active", getCameraService().isLiveStreaming());
            call.resolve(ret);
        }

        // --- Phase 2: Anti-Theft Siren ---
        @PluginMethod
        public void triggerSiren(PluginCall call) {
            try {
                AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    if (previousAlarmVolume == -1) {
                        previousAlarmVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                    }
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
                }
                if (sirenPlayer != null) {
                    sirenPlayer.stop();
                    sirenPlayer.release();
                }
                Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (alarmUri == null) {
                    alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }
                sirenPlayer = new MediaPlayer();
                sirenPlayer.setDataSource(getContext(), alarmUri);
                sirenPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
                sirenPlayer.setLooping(true);
                sirenPlayer.prepare();
                sirenPlayer.start();
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                call.reject("Failed to trigger siren: " + e.getMessage());
            }
        }

        @PluginMethod
        public void stopSiren(PluginCall call) {
            try {
                if (sirenPlayer != null) {
                    if (sirenPlayer.isPlaying()) {
                        sirenPlayer.stop();
                    }
                    sirenPlayer.release();
                    sirenPlayer = null;
                }
                AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null && previousAlarmVolume != -1) {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, previousAlarmVolume, 0);
                    previousAlarmVolume = -1;
                }
                call.resolve(new JSObject().put("success", true));
            } catch (Exception e) {
                call.reject("Failed to stop siren: " + e.getMessage());
            }
        }

        @PluginMethod
        public void setDevicePaused(PluginCall call) {
            boolean paused = call.getBoolean("paused", false);
            StayKidsAccessibilityService.setDevicePaused(paused);
            call.resolve(new JSObject().put("success", true));
        }

        // --- Phase 2: Bedtime Enforcement ---
        @PluginMethod
        public void setBedtimeSchedule(PluginCall call) {
            String time = call.getString("time", "21:00"); // format HH:mm
            String wakeTime = call.getString("wakeTime", "07:00"); // format HH:mm
            try {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) {
                    call.reject("AlarmManager not available.");
                    return;
                }

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                // 1. Schedule Bedtime Lock Alarm (Request Code 0, isWake = false)
                String[] bedtimeParts = time.split(":");
                int bedHour = Integer.parseInt(bedtimeParts[0]);
                int bedMinute = Integer.parseInt(bedtimeParts[1]);

                Calendar bedCal = Calendar.getInstance();
                bedCal.setTimeInMillis(System.currentTimeMillis());
                bedCal.set(Calendar.HOUR_OF_DAY, bedHour);
                bedCal.set(Calendar.MINUTE, bedMinute);
                bedCal.set(Calendar.SECOND, 0);

                if (bedCal.getTimeInMillis() <= System.currentTimeMillis()) {
                    bedCal.add(Calendar.DAY_OF_YEAR, 1);
                }

                Intent bedIntent = new Intent(getContext(), StayKidsBedtimeReceiver.class);
                bedIntent.putExtra("isWake", false);
                PendingIntent bedPendingIntent = PendingIntent.getBroadcast(getContext(), 0, bedIntent, flags);
                alarmManager.setRepeating(AlarmManager.RTC_WAKEUP, bedCal.getTimeInMillis(), AlarmManager.INTERVAL_DAY, bedPendingIntent);

                // 2. Schedule Wake-Time Alarm (Request Code 1, isWake = true)
                String[] wakeParts = wakeTime.split(":");
                int wakeHour = Integer.parseInt(wakeParts[0]);
                int wakeMinute = Integer.parseInt(wakeParts[1]);

                Calendar wakeCal = Calendar.getInstance();
                wakeCal.setTimeInMillis(System.currentTimeMillis());
                wakeCal.set(Calendar.HOUR_OF_DAY, wakeHour);
                wakeCal.set(Calendar.MINUTE, wakeMinute);
                wakeCal.set(Calendar.SECOND, 0);

                if (wakeCal.getTimeInMillis() <= System.currentTimeMillis()) {
                    wakeCal.add(Calendar.DAY_OF_YEAR, 1);
                }

                Intent wakeIntent = new Intent(getContext(), StayKidsBedtimeReceiver.class);
                wakeIntent.putExtra("isWake", true);
                PendingIntent wakePendingIntent = PendingIntent.getBroadcast(getContext(), 1, wakeIntent, flags);
                alarmManager.setRepeating(AlarmManager.RTC_WAKEUP, wakeCal.getTimeInMillis(), AlarmManager.INTERVAL_DAY, wakePendingIntent);

                Log.i("MainActivity", "Bedtime scheduled at " + time + " (Lock) and " + wakeTime + " (Wake)");
                call.resolve(new JSObject()
                    .put("success", true)
                    .put("message", "Bedtime scheduled at " + time + " and Wake Time at " + wakeTime));
            } catch (Exception e) {
                call.reject("Failed to set bedtime schedule: " + e.getMessage());
            }
        }

        @PluginMethod
        public void cancelBedtimeSchedule(PluginCall call) {
            try {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager == null) {
                    call.reject("AlarmManager not available.");
                    return;
                }

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }

                Intent bedIntent = new Intent(getContext(), StayKidsBedtimeReceiver.class);
                bedIntent.putExtra("isWake", false);
                PendingIntent bedPendingIntent = PendingIntent.getBroadcast(getContext(), 0, bedIntent, flags);
                alarmManager.cancel(bedPendingIntent);

                Intent wakeIntent = new Intent(getContext(), StayKidsBedtimeReceiver.class);
                wakeIntent.putExtra("isWake", true);
                PendingIntent wakePendingIntent = PendingIntent.getBroadcast(getContext(), 1, wakeIntent, flags);
                alarmManager.cancel(wakePendingIntent);

                Log.i("MainActivity", "Bedtime alarms cancelled");
                call.resolve(new JSObject().put("success", true).put("message", "Bedtime alarms cancelled"));
            } catch (Exception e) {
                call.reject("Failed to cancel bedtime schedule: " + e.getMessage());
            }
        }

        // --- Phase 2: Geofencing ---
        @PluginMethod
        public void addGeofence(PluginCall call) {
            Double lat = call.getDouble("latitude");
            Double lng = call.getDouble("longitude");
            Double radius = call.getDouble("radius", 100.0);
            String geofenceId = call.getString("id", "safe_zone_1");

            if (lat == null || lng == null) {
                call.reject("Latitude and longitude are required.");
                return;
            }
            
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Location permission not granted.");
                return;
            }

            try {
                Geofence geofence = new Geofence.Builder()
                        .setRequestId(geofenceId)
                        .setCircularRegion(lat, lng, radius.floatValue())
                        .setExpirationDuration(Geofence.NEVER_EXPIRE)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                        .build();

                GeofencingRequest geofencingRequest = new GeofencingRequest.Builder()
                        .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                        .addGeofence(geofence)
                        .build();

                Intent intent = new Intent(getContext(), StayKidsGeofenceReceiver.class);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getBroadcast(getContext(), 0, intent, flags);

                getGeofencingClient().addGeofences(geofencingRequest, pendingIntent)
                        .addOnSuccessListener(aVoid -> call.resolve(new JSObject().put("success", true)))
                        .addOnFailureListener(e -> call.reject("Failed to add geofence: " + e.getMessage()));
            } catch (Exception e) {
                call.reject("Exception setting up geofence: " + e.getMessage());
            }
        }

        @PluginMethod
        public void removeGeofence(PluginCall call) {
            String geofenceId = call.getString("id", "safe_zone_1");
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Location permission not granted.");
                return;
            }
            try {
                getGeofencingClient().removeGeofences(java.util.Collections.singletonList(geofenceId))
                        .addOnSuccessListener(aVoid -> call.resolve(new JSObject().put("success", true)))
                        .addOnFailureListener(e -> call.reject("Failed to remove geofence: " + e.getMessage()));
            } catch (Exception e) {
                call.reject("Exception removing geofence: " + e.getMessage());
            }
        }

    }
}

