package com.staykids.parent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import java.util.List;

public class StayKidsGeofenceReceiver extends BroadcastReceiver {
    private static final String TAG = "StayKidsGeofence";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        
        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null) {
            Log.e(TAG, "GeofencingEvent from intent is null.");
            return;
        }
        if (geofencingEvent.hasError()) {
            Log.e(TAG, "Geofencing error: " + geofencingEvent.getErrorCode());
            return;
        }

        int geofenceTransition = geofencingEvent.getGeofenceTransition();
        if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER ||
            geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
            
            String transitionDetails = (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) ? "ENTER" : "EXIT";
            
            List<Geofence> triggeringGeofences = geofencingEvent.getTriggeringGeofences();
            String geofenceId = "safe_zone_1";
            if (triggeringGeofences != null && !triggeringGeofences.isEmpty()) {
                geofenceId = triggeringGeofences.get(0).getRequestId();
            }

            Log.i(TAG, "Geofence transition: " + transitionDetails + " for zone: " + geofenceId);
            
            // Broadcast transition details and specific geofence ID to MainActivity's geofenceReceiver
            Intent notifyIntent = new Intent("com.staykids.parent.GEOFENCE_EVENT");
            notifyIntent.putExtra("transition", transitionDetails);
            notifyIntent.putExtra("geofenceId", geofenceId);
            context.sendBroadcast(notifyIntent);
        } else {
            Log.e(TAG, "Invalid transition type: " + geofenceTransition);
        }
    }
}
