package com.staykids.parent;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.content.Intent;
import android.util.Log;
import org.json.JSONObject;

public class StayKidsNotificationListener extends NotificationListenerService {
    private static final String TAG = "StayKidsNotification";
    public static final String ACTION_NOTIFICATION_POSTED = "com.staykids.parent.NOTIFICATION_POSTED";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;
        
        String packageName = sbn.getPackageName();
        
        // Only track important social/communication apps to save bandwidth and privacy
        if (!packageName.contains("whatsapp") && 
            !packageName.contains("messenger") && 
            !packageName.contains("mms") && 
            !packageName.contains("sms") && 
            !packageName.contains("viber") && 
            !packageName.contains("imo")) {
            return;
        }

        Notification notification = sbn.getNotification();
        CharSequence title = notification.extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = notification.extras.getCharSequence(Notification.EXTRA_TEXT);

        if (title == null || text == null) return;

        try {
            JSONObject data = new JSONObject();
            data.put("packageName", packageName);
            data.put("title", title.toString());
            data.put("text", text.toString());
            data.put("postTime", sbn.getPostTime());

            Intent intent = new Intent(ACTION_NOTIFICATION_POSTED);
            intent.putExtra("notificationData", data.toString());
            sendBroadcast(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error parsing notification", e);
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // Handle removal if necessary
    }
}
