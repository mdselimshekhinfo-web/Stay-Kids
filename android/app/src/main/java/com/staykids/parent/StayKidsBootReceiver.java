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
            
            Log.i(TAG, "Device rebooted or package updated. Auto-starting StayKids protection service.");
            
            try {
                Intent mainIntent = new Intent(context, MainActivity.class);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(mainIntent);
            } catch (Exception e) {
                Log.e(TAG, "Failed to auto-start MainActivity on boot: " + e.getMessage());
            }
        }
    }
}
