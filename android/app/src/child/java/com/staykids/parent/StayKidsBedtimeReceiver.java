package com.staykids.parent;

import android.app.admin.DevicePolicyManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class StayKidsBedtimeReceiver extends BroadcastReceiver {
    private static final String TAG = "StayKidsBedtimeReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        boolean isWake = intent != null && intent.getBooleanExtra("isWake", false);

        if (isWake) {
            Log.i(TAG, "Wake time reached. Deactivating bedtime enforcement mode.");
            StayKidsAccessibilityService.setBedtimeActive(false);
            return;
        }

        Log.i(TAG, "Bedtime reached. Enforcing device lock & Accessibility app blocking.");
        
        // 1. Lock screen immediately
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName compName = new ComponentName(context, StayKidsDeviceAdminReceiver.class);
        if (dpm != null && dpm.isAdminActive(compName)) {
            dpm.lockNow();
        } else {
            Log.w(TAG, "Device Admin not active. Immediate screen lock skipped.");
        }

        // 2. Activate continuous accessibility bedtime mode (blocks non-emergency app launches)
        StayKidsAccessibilityService.setBedtimeActive(true);
    }
}
