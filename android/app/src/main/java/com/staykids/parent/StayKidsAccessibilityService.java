package com.staykids.parent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.provider.Settings;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import java.util.HashSet;
import java.util.Set;

public class StayKidsAccessibilityService extends AccessibilityService {

    private static final String TAG = "StayKidsAccessibility";
    private static StayKidsAccessibilityService instance;
    private static final Set<String> blockedPackageNames = java.util.Collections.synchronizedSet(new HashSet<>());

    static {
        blockedPackageNames.add("com.roblox.client");
        blockedPackageNames.add("com.zhiliaoapp.musically"); // TikTok
        blockedPackageNames.add("com.google.android.youtube");
        blockedPackageNames.add("com.instagram.android");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.i(TAG, "StayKids Accessibility Service Initialized.");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        android.content.SharedPreferences prefs = getSharedPreferences("StayKidsPrefs", android.content.Context.MODE_PRIVATE);
        java.util.Set<String> savedApps = prefs.getStringSet("blockedApps", null);
        if (savedApps != null) {
            blockedPackageNames.addAll(savedApps);
        }
    }

    public static StayKidsAccessibilityService getInstance() {
        return instance;
    }

    public static void setAppBlocked(String packageName, boolean blocked) {
        if (blocked) {
            blockedPackageNames.add(packageName);
        } else {
            blockedPackageNames.remove(packageName);
        }
        if (instance != null) {
            android.content.SharedPreferences prefs = instance.getSharedPreferences("StayKidsPrefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putStringSet("blockedApps", new java.util.HashSet<>(blockedPackageNames)).apply();
        }
    }

    public static boolean isAppBlocked(String packageName) {
        return blockedPackageNames.contains(packageName);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence packageName = event.getPackageName();
            if (packageName != null) {
                String pkg = packageName.toString();
                if (blockedPackageNames.contains(pkg)) {
                    Log.w(TAG, "Blocked app launched by child: " + pkg + ". Enforcing HOME redirection.");
                    performGlobalAction(GLOBAL_ACTION_HOME);
                }
            }
        }
    }

    public void performRemoteTouch(float x, float y) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.N) { return; }
        Path clickPath = new Path();
        clickPath.moveTo(x, y);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(clickPath, 0, 100);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);
        dispatchGesture(builder.build(), null, null);
    }

    public void performRemoteSwipe(float startX, float startY, float endX, float endY) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.N) { return; }
        Path swipePath = new Path();
        swipePath.moveTo(startX, startY);
        swipePath.lineTo(endX, endY);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(swipePath, 0, 300);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);
        dispatchGesture(builder.build(), null, null);
    }

    public void performNavigationAction(String action) {
        if ("HOME".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_HOME);
        } else if ("BACK".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_BACK);
        } else if ("RECENTS".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_RECENTS);
        } else if ("NOTIFICATIONS".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
        } else if ("QUICK_SETTINGS".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
        } else if ("LOCK_SCREEN".equalsIgnoreCase(action)) {
            performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
        } else if ("OPEN_SETTINGS".equalsIgnoreCase(action)) {
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            }
        } else if ("SWIPE_UP".equalsIgnoreCase(action)) {
            performRemoteSwipe(500, 1500, 500, 300);
        } else if ("SWIPE_DOWN".equalsIgnoreCase(action)) {
            performRemoteSwipe(500, 300, 500, 1500);
        }
    }

    @Override
    public void onInterrupt() {
        Log.i(TAG, "StayKids Accessibility Service Interrupted.");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }
}
