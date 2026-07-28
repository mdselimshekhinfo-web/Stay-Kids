package com.staykids.parent;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Path;
import android.provider.Settings;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.HashSet;
import java.util.Set;
import java.util.List;
import java.util.Arrays;

public class StayKidsAccessibilityService extends AccessibilityService {

    private static final String TAG = "StayKidsAccessibility";
    private static StayKidsAccessibilityService instance;
    private static final Set<String> blockedPackageNames = java.util.Collections.synchronizedSet(new HashSet<>());
    private static boolean isWebFilterEnabled = false;
    private static final List<String> BLOCKED_KEYWORDS = Arrays.asList("porn", "xxx", "casino", "gambling", "adult");

    // A.3 Browser coverage for web filter: Chrome, Firefox, Samsung, Xiaomi, Opera, Edge, UC
    private static final Set<String> BROWSER_PACKAGES = new HashSet<>(Arrays.asList(
        "com.android.chrome",
        "org.mozilla.firefox",
        "com.sec.android.app.sbrowser",
        "com.mi.globalbrowser",
        "com.opera.browser",
        "com.microsoft.emmx",
        "com.UCMobile.intl"
    ));

    private static final int MAX_TREE_DEPTH = 20;

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
        isWebFilterEnabled = prefs.getBoolean("webFilter", false);
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

    public static void setWebFilterEnabled(boolean enabled) {
        isWebFilterEnabled = enabled;
        if (instance != null) {
            android.content.SharedPreferences prefs = instance.getSharedPreferences("StayKidsPrefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putBoolean("webFilter", enabled).apply();
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        int eventType = event.getEventType();
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            CharSequence packageName = event.getPackageName();
            if (packageName != null) {
                String pkg = packageName.toString();
                if (blockedPackageNames.contains(pkg)) {
                    Log.w(TAG, "Blocked app launched by child: " + pkg + ". Enforcing HOME redirection.");
                    performGlobalAction(GLOBAL_ACTION_HOME);
                    return;
                }
                
                if (isWebFilterEnabled && BROWSER_PACKAGES.contains(pkg)) {
                    AccessibilityNodeInfo source = event.getSource();
                    if (source != null) {
                        checkNodesForUrl(source, 0);
                    }
                }
            }
        }
    }

    /**
     * A.4 Web Filter URL Bar Inspector
     * Limitation Note: Address-bar URL inspection checks visible url-bar node text against blocked keywords.
     * Modern browsers may obscure full URLs, display only domain names, run incognito tabs, or use custom
     * in-app web views. This is an accessibility-layer heuristic, not deep packet content filtering.
     *
     * A.5 Tree Walk Depth Limit & Node Recycling Guard
     */
    private void checkNodesForUrl(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > MAX_TREE_DEPTH) return;
        
        try {
            if (node.getText() != null) {
                String text = node.getText().toString().toLowerCase();
                if (node.getViewIdResourceName() != null && node.getViewIdResourceName().contains("url_bar")) {
                    for (String keyword : BLOCKED_KEYWORDS) {
                        if (text.contains(keyword)) {
                            Log.w(TAG, "Blocked website detected: " + text + ". Enforcing HOME redirection.");
                            performGlobalAction(GLOBAL_ACTION_HOME);
                            return;
                        }
                    }
                }
            }
            
            int childCount = node.getChildCount();
            for (int i = 0; i < childCount; i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    checkNodesForUrl(child, depth + 1);
                }
            }
        } finally {
            if (android.os.Build.VERSION.SDK_INT < 33) {
                try {
                    node.recycle();
                } catch (Exception ignored) {}
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
