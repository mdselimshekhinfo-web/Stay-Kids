package com.staykids.parent;

import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;
import android.os.Bundle;
import android.util.Log;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.content.Context;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "StayKidsParentMainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StayKidsNativePlugin.class);
        super.onCreate(savedInstanceState);
        Log.i(TAG, "StayKids Parent MainActivity initialized with Parent Native Plugin Suite.");
    }

    @CapacitorPlugin(name = "StayKidsNative")
    public static class StayKidsNativePlugin extends Plugin {

        @PluginMethod
        public void getAppRole(PluginCall call) {
            call.resolve(new JSObject().put("role", BuildConfig.STAYKIDS_ROLE));
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
                });

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title)
                        .setSubtitle(subtitle)
                        .setDeviceCredentialAllowed(true)
                        .build();

                biometricPrompt.authenticate(promptInfo);
            });
        }

        @PluginMethod
        public void getFcmToken(PluginCall call) {
            try {
                FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                    if (!task.isSuccessful()) {
                        Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                        call.reject("Failed to get FCM token");
                        return;
                    }
                    String token = task.getResult();
                    call.resolve(new JSObject().put("token", token));
                });
            } catch (Exception e) {
                call.reject("Error getting FCM token: " + e.getMessage());
            }
        }

        @PluginMethod
        public void getScreenResolution(PluginCall call) {
            try {
                WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
                DisplayMetrics metrics = new DisplayMetrics();
                if (wm != null && wm.getDefaultDisplay() != null) {
                    wm.getDefaultDisplay().getRealMetrics(metrics);
                    JSObject ret = new JSObject();
                    ret.put("screenWidth", metrics.widthPixels);
                    ret.put("screenHeight", metrics.heightPixels);
                    call.resolve(ret);
                } else {
                    call.reject("WindowManager unavailable");
                }
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }
    }
}
