package com.staykids.parent;

import android.Manifest;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.ContextCompat;
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
        super.onCreate(savedInstanceState);
        registerPlugin(StayKidsNativePlugin.class);
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
            )
        }
    )
    public static class StayKidsNativePlugin extends Plugin {

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
                        enabled = settingValue.contains(service) || settingValue.contains(getContext().getPackageName());
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
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
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
        public void performRemoteTouch(PluginCall call) {
            Double x = call.getDouble("x", 270.0);
            Double y = call.getDouble("y", 480.0);
            StayKidsAccessibilityService service = StayKidsAccessibilityService.getInstance();
            if (service != null) {
                android.util.DisplayMetrics metrics = getContext().getResources().getDisplayMetrics();
                float scaleX = metrics.widthPixels / 540f;
                float scaleY = metrics.heightPixels / 960f;
                float actualX = x.floatValue() * scaleX;
                float actualY = y.floatValue() * scaleY;
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
                call.resolve(new JSObject().put("success", true).put("apps", appsArray));
            } catch (Exception e) {
                call.reject("Failed to query installed apps: " + e.getMessage());
            }
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
            StayKidsCameraService cameraService = new StayKidsCameraService(getContext());
            cameraService.captureSilentSnapshot(new StayKidsCameraService.SnapshotCallback() {
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
            StayKidsLocationService locationService = new StayKidsLocationService(getContext());
            locationService.getCurrentLocation(new StayKidsLocationService.LocationCallback() {
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
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            ComponentName compName = new ComponentName(getContext(), StayKidsDeviceAdminReceiver.class);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName);
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "StayKids anti-uninstall protection prevents unauthorized removal.");
            getContext().startActivity(intent);
            call.resolve();
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
                } else {
                    intent.setAction(Settings.ACTION_BATTERY_SAVER_SETTINGS);
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                Intent fallback = new Intent(Settings.ACTION_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
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

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(serviceIntent);
                    } else {
                        getContext().startService(serviceIntent);
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
                StayKidsScreenCaptureService.stopScreenCapture();
                call.resolve(new JSObject().put("success", true).put("streaming", false));
            } catch (Exception e) {
                call.resolve(new JSObject().put("success", false).put("error", e.getMessage()));
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
                StayKidsAudioService.stopAudioCapture();
                call.resolve(new JSObject().put("success", true).put("capturing", false));
            } catch (Exception e) {
                call.resolve(new JSObject().put("success", false).put("error", e.getMessage()));
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

    }
}
