package com.staykids.parent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Secret Dial Code Receiver (*#*#7829#*#*)
 * Triggers when parent or supervisor dials *#*#7829#*#* on the phone dialer.
 * Launches StayKids MainActivity even if launcher icon is concealed.
 */
public class StayKidsSecretCodeReceiver extends BroadcastReceiver {
    private static final String TAG = "StayKidsSecretCode";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && "android.provider.Telephony.SECRET_CODE".equals(intent.getAction())) {
            Log.d(TAG, "Secret dial code *#*#7829#*#* triggered. Launching StayKids...");
            try {
                Intent launchIntent = new Intent(context, MainActivity.class);
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                context.startActivity(launchIntent);
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch StayKids from secret dial code: " + e.getMessage());
            }
        }
    }
}
