package com.staykids.parent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import java.util.Calendar;
import java.util.List;

public class StayKidsUsageService extends Service {
    private static final String TAG = "StayKidsUsageService";
    private static final String CHANNEL_ID = "staykids_usage_channel";
    private static final int NOTIFICATION_ID = 8845;
    private static final long POLL_INTERVAL = 60000; // 1 minute

    private Handler handler;
    private HandlerThread handlerThread;
    private Runnable runnable;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);

        handlerThread = new HandlerThread("StayKidsUsageThread");
        handlerThread.start();
        handler = new Handler(handlerThread.getLooper());
        runnable = new Runnable() {
            @Override
            public void run() {
                checkScreenTime();
                handler.postDelayed(this, POLL_INTERVAL);
            }
        };
        handler.post(runnable);
        Log.i(TAG, "StayKidsUsageService started as a Foreground Service.");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "StayKids Screen Time Guard",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Monitors daily screen time limits to keep your child safe.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("Screen Time Protection Active")
            .setContentText("Monitoring daily app usage limits.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .build();
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
        
        if (stats != null && !stats.isEmpty()) {
            for (UsageStats stat : stats) {
                if (stat != null && stat.getPackageName() != null) {
                    String pkg = stat.getPackageName();
                    if (!pkg.equals("android") && !pkg.equals("com.android.systemui") && !pkg.equals(getPackageName())) {
                        totalForegroundTime += stat.getTotalTimeInForeground();
                    }
                }
            }
        }

        long totalMinutesUsed = totalForegroundTime / (1000 * 60);
        Log.d(TAG, "Total screen time today: " + totalMinutesUsed + " mins. Limit: " + dailyLimitMinutes);

        if (totalMinutesUsed >= dailyLimitMinutes) {
            enforceTimeLimit();
        }
    }

    private void enforceTimeLimit() {
        Log.w(TAG, "Screen time limit exceeded! Enforcing HOME redirection via Accessibility.");
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
        if (handler != null && runnable != null) {
            handler.removeCallbacks(runnable);
        }
        if (handlerThread != null) {
            handlerThread.quitSafely();
        }
        stopForeground(true);
        super.onDestroy();
    }
}
