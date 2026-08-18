import * as kv from './kv_store.tsx';

import { SignJWT, importPKCS8 } from 'npm:jose';

// Priority 1: FCM Push Notification Dispatcher Helper
// Migrated to FCM HTTP v1 API with OAuth2 service account.
export async function sendFcmPushNotification(parentEmail: string, title: string, body: string, dataPayload: Record<string, string> = {}) {
  try {
    const fcmToken = await kv.get(`fcm_token:${parentEmail.toLowerCase()}`);
    if (!fcmToken) return;

    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      console.log(`[FCM Push] FCM_SERVICE_ACCOUNT_JSON not configured. Intended push to ${parentEmail}: "${title} - ${body}"`);
      return;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
    const jwt = await new SignJWT({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data: { click_action: "FLUTTER_NOTIFICATION_CLICK", screen: "Alerts", ...dataPayload },
        }
      }),
    });
  } catch (e) {
    console.error("FCM Push Dispatch Error:", e);
  }
}
