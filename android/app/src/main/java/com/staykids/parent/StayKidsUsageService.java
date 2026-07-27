package com.staykids.parent;

import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;

import java.util.Calendar;
import java.util.List;

public class StayKidsUsageService extends Service {
    private static final String TAG = "StayKidsUsageService";
    private Handler handler;
    private Runnable runnable;
    private static final long POLL_INTERVAL = 60000; // 1 minute

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler();
        runnable = new Runnable() {
            @Override
            public void run() {
                checkScreenTime();
                handler.postDelayed(this, POLL_INTERVAL);
            }
        };
        handler.post(runnable);
        Log.i(TAG, "Usage Service started");
    }

    private void checkScreenTime() {
        SharedPreferences prefs = getSharedPreferences("StayKidsPrefs", Context.MODE_PRIVATE);
        int dailyLimitMinutes = prefs.getInt("dailyLimit", -1);
        if (dailyLimitMinutes <= 0) return;

        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return;

        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        long startTime = calendar.getTimeInMillis();
        long endTime = System.currentTimeMillis();

        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
        long totalForegroundTime = 0;
        
        for (UsageStats stat : stats) {
            String pkg = stat.getPackageName();
            if (!pkg.equals("android") && !pkg.equals("com.android.systemui") && !pkg.equals("com.staykids.parent")) {
                totalForegroundTime += stat.getTotalTimeInForeground();
            }
        }

        long totalMinutesUsed = totalForegroundTime / (1000 * 60);
        Log.d(TAG, "Total screen time today: " + totalMinutesUsed + " mins. Limit: " + dailyLimitMinutes);

        if (totalMinutesUsed >= dailyLimitMinutes) {
            enforceTimeLimit();
        }
    }

    private void enforceTimeLimit() {
        Log.w(TAG, "Screen time limit exceeded! Locking device via Accessibility.");
        StayKidsAccessibilityService service = StayKidsAccessibilityService.getInstance();
        if (service != null) {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null && runnable != null) {
            handler.removeCallbacks(runnable);
        }
    }
}
