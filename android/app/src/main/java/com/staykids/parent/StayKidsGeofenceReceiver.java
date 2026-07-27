package com.staykids.parent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import com.getcapacitor.JSObject;

public class StayKidsGeofenceReceiver extends BroadcastReceiver {
    private static final String TAG = "StayKidsGeofence";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent.hasError()) {
            Log.e(TAG, "Geofencing error: " + geofencingEvent.getErrorCode());
            return;
        }

        int geofenceTransition = geofencingEvent.getGeofenceTransition();
        if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER ||
            geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
            
            // Fire event to JS using a broadcast or static method if needed.
            // For now, we will log it. In a real scenario we'd send it via the plugin.
            String transitionDetails = (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) ? "ENTER" : "EXIT";
            Log.i(TAG, "Geofence transition: " + transitionDetails);
            
            Intent notifyIntent = new Intent("com.staykids.parent.GEOFENCE_EVENT");
            notifyIntent.putExtra("transition", transitionDetails);
            context.sendBroadcast(notifyIntent);
        } else {
            Log.e(TAG, "Invalid transition type: " + geofenceTransition);
        }
    }
}
