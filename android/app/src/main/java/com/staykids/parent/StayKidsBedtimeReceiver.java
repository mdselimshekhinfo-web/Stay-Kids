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
        Log.i(TAG, "Bedtime reached. Locking device.");
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName compName = new ComponentName(context, StayKidsDeviceAdminReceiver.class);
        if (dpm != null && dpm.isAdminActive(compName)) {
            dpm.lockNow();
        } else {
            Log.w(TAG, "Device Admin not active. Cannot lock device.");
        }
    }
}
