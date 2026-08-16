package com.staykids.parent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class StayKidsBootReceiver extends BroadcastReceiver {

    private static final String TAG = "StayKidsBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "StayKids Boot Receiver triggered with action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.i(TAG, "Device rebooted or package updated. Accessibility Service is automatically re-bound by Android OS.");
            // Android 10+ (API 29+) prohibits launching visible Activities directly from background BroadcastReceivers.
            // Core protection (StayKidsAccessibilityService) is automatically re-bound by Android OS upon boot.
        }
    }
}
