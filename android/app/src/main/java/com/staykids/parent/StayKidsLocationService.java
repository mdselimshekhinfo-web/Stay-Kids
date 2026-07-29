package com.staykids.parent;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.util.Log;

public class StayKidsLocationService {

    private static final String TAG = "StayKidsLocationService";
    private static final long MAX_LOCATION_AGE_MS = 2 * 60 * 1000L; // 2 minutes max staleness threshold
    private final Context context;

    public StayKidsLocationService(Context context) {
        this.context = context;
    }

    public interface LocationCallback {
        void onSuccess(double latitude, double longitude);
        void onError(String error);
    }

    public void getCurrentLocation(LocationCallback callback) {
        LocationManager locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            callback.onError("Location service unavailable");
            return;
        }

        try {
            boolean isGpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean isNetworkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);

            if (!isGpsEnabled && !isNetworkEnabled) {
                callback.onError("GPS and Location providers are disabled");
                return;
            }

            String provider = isGpsEnabled ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
            Location lastKnown = locationManager.getLastKnownLocation(provider);

            // 1. Age check on getLastKnownLocation() to ensure real-time accuracy
            if (lastKnown != null) {
                long locationAgeMs = System.currentTimeMillis() - lastKnown.getTime();
                if (locationAgeMs >= 0 && locationAgeMs <= MAX_LOCATION_AGE_MS) {
                    Log.i(TAG, "Fresh last known location retrieved (age: " + (locationAgeMs / 1000) + "s): " 
                        + lastKnown.getLatitude() + ", " + lastKnown.getLongitude());
                    callback.onSuccess(lastKnown.getLatitude(), lastKnown.getLongitude());
                    return;
                } else {
                    Log.i(TAG, "Last known location is stale (age: " + (locationAgeMs / 1000) + "s). Requesting fresh GPS fix...");
                }
            }

            java.util.concurrent.atomic.AtomicBoolean handled = new java.util.concurrent.atomic.AtomicBoolean(false);
            LocationListener listener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    if (handled.compareAndSet(false, true)) {
                        // 2. Explicitly unregister listener on success path for OEM robustness
                        try { locationManager.removeUpdates(this); } catch (Exception ignored) {}
                        if (location != null) {
                            Log.i(TAG, "Fresh location update: " + location.getLatitude() + ", " + location.getLongitude());
                            callback.onSuccess(location.getLatitude(), location.getLongitude());
                        } else {
                            callback.onError("Failed to obtain GPS coordinates");
                        }
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(String provider) {}

                @Override
                public void onProviderDisabled(String provider) {}
            };
            locationManager.requestSingleUpdate(provider, listener, android.os.Looper.getMainLooper());
            
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (handled.compareAndSet(false, true)) {
                    try { locationManager.removeUpdates(listener); } catch (Exception ignored) {}
                    callback.onError("Location request timed out after 15 seconds");
                }
            }, 15000);

        } catch (SecurityException e) {
            callback.onError("Location permission not granted: " + e.getMessage());
        } catch (Exception e) {
            callback.onError("Location exception: " + e.getMessage());
        }
    }
}
