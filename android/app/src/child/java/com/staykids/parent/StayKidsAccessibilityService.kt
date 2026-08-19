package com.staykids.parent

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.content.Intent
import android.graphics.Path
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class StayKidsAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "StayKidsAccessibility"
        private var instance: StayKidsAccessibilityService? = null
        private val blockedPackageNames = java.util.Collections.synchronizedSet(mutableSetOf<String>())
        private var isWebFilterEnabled = false
        private var isBedtimeModeActive = false
        private var isDevicePaused = false
        private val BLOCKED_KEYWORDS = listOf("porn", "xxx", "casino", "gambling", "adult")

        private val ALLOWED_BEDTIME_PACKAGES = setOf(
            "com.staykids.parent",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.sec.android.provider.badge",
            "com.samsung.android.dialer",
            "com.android.phone",
            "com.android.systemui",
            "android"
        )

        private val BROWSER_PACKAGES = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.sec.android.app.sbrowser",
            "com.mi.globalbrowser",
            "com.opera.browser",
            "com.microsoft.emmx",
            "com.UCMobile.intl"
        )

        private const val MAX_TREE_DEPTH = 20

        @JvmStatic
        fun getInstance(): StayKidsAccessibilityService? {
            return instance
        }

        @JvmStatic
        fun setBedtimeActive(active: Boolean) {
            isBedtimeModeActive = active
            instance?.let {
                val prefs = it.getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("bedtimeActive", active).apply()
                if (active) {
                    it.performGlobalAction(GLOBAL_ACTION_HOME)
                }
            }
        }

        @JvmStatic
        fun setDevicePaused(paused: Boolean) {
            isDevicePaused = paused
            instance?.let {
                val prefs = it.getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("devicePaused", paused).apply()
                if (paused) {
                    it.performGlobalAction(GLOBAL_ACTION_HOME)
                }
            }
        }

        @JvmStatic
        fun isBedtimeActive(): Boolean {
            return isBedtimeModeActive
        }

        @JvmStatic
        fun setAppBlocked(packageName: String, blocked: Boolean) {
            if (blocked) {
                blockedPackageNames.add(packageName)
            } else {
                blockedPackageNames.remove(packageName)
            }
            instance?.let {
                val prefs = it.getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE)
                synchronized(blockedPackageNames) {
                    prefs.edit().putStringSet("blockedApps", HashSet(blockedPackageNames)).apply()
                }
            }
        }

        @JvmStatic
        fun isAppBlocked(packageName: String): Boolean {
            return blockedPackageNames.contains(packageName)
        }

        @JvmStatic
        fun setWebFilterEnabled(enabled: Boolean) {
            isWebFilterEnabled = enabled
            instance?.let {
                val prefs = it.getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE)
                prefs.edit().putBoolean("webFilter", enabled).apply()
            }
        }
    }

    private var lastLoggedUrl = ""
    private var lastLoggedUrlTime: Long = 0

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i(TAG, "StayKids Accessibility Service Initialized.")
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        val prefs = getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE)
        val savedApps = prefs.getStringSet("blockedApps", null)
        if (savedApps != null) {
            blockedPackageNames.addAll(savedApps)
        }
        isWebFilterEnabled = prefs.getBoolean("webFilter", false)
        isBedtimeModeActive = prefs.getBoolean("bedtimeActive", false)
        isDevicePaused = prefs.getBoolean("devicePaused", false)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val eventType = event.eventType
        if (eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            val packageName = event.packageName
            if (packageName != null) {
                val pkg = packageName.toString()

                if ((isBedtimeModeActive || isDevicePaused) && !ALLOWED_BEDTIME_PACKAGES.contains(pkg)) {
                    Log.w(TAG, "Device paused or bedtime active. Non-essential app launch blocked: \$pkg. Enforcing HOME redirection.")
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    return
                }

                if (blockedPackageNames.contains(pkg)) {
                    Log.w(TAG, "Blocked app launched by child: \$pkg. Enforcing HOME redirection.")
                    performGlobalAction(GLOBAL_ACTION_HOME)
                    return
                }

                if (isWebFilterEnabled && BROWSER_PACKAGES.contains(pkg)) {
                    val source = event.source
                    if (source != null) {
                        checkNodesForUrl(source, 0)
                    }
                }
            }
        }
    }

    private fun broadcastWebVisit(url: String?) {
        if (url.isNullOrBlank() || url.length < 3) return
        val now = System.currentTimeMillis()
        if (url.equals(lastLoggedUrl, ignoreCase = true) && (now - lastLoggedUrlTime < 10000)) return
        lastLoggedUrl = url
        lastLoggedUrlTime = now

        val intent = Intent("com.staykids.parent.WEB_VISIT_EVENT")
        intent.putExtra("url", url)
        sendBroadcast(intent)
    }

    private fun checkNodesForUrl(node: AccessibilityNodeInfo?, depth: Int): Boolean {
        if (node == null || depth > MAX_TREE_DEPTH) return false

        try {
            if (node.text != null) {
                val text = node.text.toString().lowercase()
                if (node.viewIdResourceName != null && node.viewIdResourceName.contains("url_bar")) {
                    broadcastWebVisit(text)
                    for (keyword in BLOCKED_KEYWORDS) {
                        if (text.contains(keyword)) {
                            Log.w(TAG, "Blocked website detected: \$text. Enforcing HOME redirection.")
                            performGlobalAction(GLOBAL_ACTION_HOME)
                            return true
                        }
                    }
                }
            }

            val childCount = node.childCount
            for (i in 0 until childCount) {
                val child = node.getChild(i)
                if (child != null) {
                    val blocked = checkNodesForUrl(child, depth + 1)
                    if (blocked) return true
                }
            }
        } finally {
            if (Build.VERSION.SDK_INT < 33) {
                try {
                    @Suppress("DEPRECATION")
                    node.recycle()
                } catch (ignored: Exception) {
                }
            }
        }
        return false
    }

    fun performRemoteTouch(x: Float, y: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) { return }
        val clickPath = Path()
        clickPath.moveTo(x, y)
        val stroke = GestureDescription.StrokeDescription(clickPath, 0, 100)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        dispatchGesture(builder.build(), null, null)
    }

    fun performRemoteSwipe(startX: Float, startY: Float, endX: Float, endY: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) { return }
        val swipePath = Path()
        swipePath.moveTo(startX, startY)
        swipePath.lineTo(endX, endY)
        val stroke = GestureDescription.StrokeDescription(swipePath, 0, 300)
        val builder = GestureDescription.Builder()
        builder.addStroke(stroke)
        dispatchGesture(builder.build(), null, null)
    }

    fun performNavigationAction(action: String) {
        when (action.uppercase()) {
            "HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "RECENTS" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "NOTIFICATIONS" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "QUICK_SETTINGS" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
            "LOCK_SCREEN" -> performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            "OPEN_SETTINGS" -> {
                try {
                    val intent = Intent(Settings.ACTION_SETTINGS)
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                } catch (e: Exception) {
                    performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
                }
            }
            "SWIPE_UP" -> performRemoteSwipe(500f, 1500f, 500f, 300f)
            "SWIPE_DOWN" -> performRemoteSwipe(500f, 300f, 500f, 1500f)
        }
    }

    override fun onInterrupt() {
        Log.i(TAG, "StayKids Accessibility Service Interrupted.")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }
}
