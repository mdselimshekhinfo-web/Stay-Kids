import * as kv from './kv_store.tsx';

// Priority 1: FCM Push Notification Dispatcher Helper
// ⚠️ WARNING: Uses deprecated Legacy FCM HTTP API (fcm.googleapis.com/fcm/send).
// Google will shut this down. Migrate to FCM HTTP v1 API with OAuth2 service account.
export async function sendFcmPushNotification(parentEmail: string, title: string, body: string, dataPayload: Record<string, string> = {}) {
  try {
    const fcmToken = await kv.get(`fcm_token:${parentEmail.toLowerCase()}`);
    if (!fcmToken) return;

    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmServerKey) {
      console.log(`[FCM Push] FCM_SERVER_KEY not configured. Intended push to ${parentEmail}: "${title} - ${body}"`);
      return;
    }

    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: fcmToken,
        notification: { title, body, sound: "default" },
        data: { click_action: "FLUTTER_NOTIFICATION_CLICK", screen: "Alerts", ...dataPayload },
      }),
    });
  } catch (e) {
    console.error("FCM Push Dispatch Error:", e);
  }
}
