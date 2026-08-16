package com.staykids.parent;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class StayKidsDeviceAdminReceiver extends DeviceAdminReceiver {

    private static final String TAG = "StayKidsDeviceAdmin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.i(TAG, "StayKids Device Administrator Protection Enabled.");
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        return "StayKids Parental Protection requires Device Admin to prevent unauthorized removal by child.";
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "StayKids Device Administrator Disabled.");
    }
}
