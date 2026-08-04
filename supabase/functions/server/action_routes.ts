import { Hono } from 'npm:hono';
import { getAuthContext, getStateFromDB, saveStateToDB, defaultState } from './db.ts';
import { sendFcmPushNotification } from './notifications.ts';
import { checkRateLimit } from './security.ts';
import * as kv from './kv_store.tsx';
import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export const actionRoutes = new Hono();

// GET state endpoint (With 2.2 Ephemeral Live Streams KV Merging)
actionRoutes.get("/state", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }
    const state = await getStateFromDB(authCtx.email);
    if (!state) return c.json(JSON.parse(JSON.stringify(defaultState)));

    // Merge transient live stream state & WebRTC signaling from KV store (2.2)
    const targetChildId = authCtx.childId || state.activeChildId || "child-1";
    const liveKey = `live:${authCtx.email.toLowerCase()}:${targetChildId}`;
    const liveData = await kv.get(liveKey);
    if (liveData && Date.now() - liveData.timestamp < 30000) {
      state.remote = {
        ...state.remote,
        liveFrame: liveData.liveFrame || state.remote.liveFrame,
        liveAudioChunk: liveData.liveAudioChunk || state.remote.liveAudioChunk,
        webrtcOffer: liveData.webrtcOffer || state.remote.webrtcOffer,
        webrtcAnswer: liveData.webrtcAnswer || state.remote.webrtcAnswer,
        webrtcCandidates: liveData.webrtcCandidates || state.remote.webrtcCandidates || [],
        connectionState: liveData.connectionState || state.remote.connectionState,
      };
    }

    return c.json(state);
  } catch (_e) {
    return c.json({ error: "Failed to load state" }, 500);
  }
});

// POST action endpoint for real-time state mutation & persistence
actionRoutes.post("/action", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }

    const action = await c.req.json();

    const DEVICE_ALLOWED_ACTIONS = [
      "protection-status", "trigger-sos", "audio-chunk",
      "webrtc-signal", "capture-snapshot", "audio-toggle",
      "geofence-alert", "installed-apps-telemetry", "sync-call-sms-logs",
      "web-visit-telemetry", "device-telemetry", "add-reward-points", "redeem-reward-points"
    ];
    if (authCtx.isDevice && !DEVICE_ALLOWED_ACTIONS.includes(action.type)) {
      return c.json({ error: "Action not permitted for device tokens" }, 403);
    }
    if (authCtx.isDevice && !authCtx.childId) {
      return c.json({ success: false, error: "Device token missing childId" }, 400);
    }

    let state: any;
    try {
      state = (await getStateFromDB(authCtx.email)) || JSON.parse(JSON.stringify(defaultState));
    } catch(e) {
      return c.json({ error: "Database unavailable for action processing." }, 500);
    }

    const targetChildId = authCtx.isDevice
      ? (authCtx.childId || "child-1")
      : (action.childId || state.activeChildId || state.child?.id || "child-1");

    // Critical Security Fix: Parent Child Ownership Authorization Guard
    if (!authCtx.isDevice && action.type !== "add-child") {
      const ownsChild = state.children?.some((c: any) => c.id === targetChildId) || (state.child?.id === targetChildId);
      if (!ownsChild) {
        return c.json({ error: "Child not found or not owned by this account." }, 403);
      }
    }

    // 2.2 Ephemeral Bypass for High-Frequency Streaming Actions & WebRTC Signaling
    if (action.type === "audio-chunk" || action.type === "webrtc-signal") {
      const liveKey = `live:${authCtx.email.toLowerCase()}:${targetChildId}`;
      const existingLive = (await kv.get(liveKey)) || {};

      let pendingCandidates = existingLive.webrtcCandidates || [];
      if (action.candidate) {
        pendingCandidates.push(action.candidate);
      }
      if (action.clearSignal) {
        pendingCandidates = [];
      }

      const updatedLive = {
        ...existingLive,
        liveFrame: action.frame || existingLive.liveFrame,
        liveAudioChunk: action.chunk || existingLive.liveAudioChunk,
        webrtcOffer: action.offer !== undefined ? action.offer : existingLive.webrtcOffer,
        webrtcAnswer: action.answer !== undefined ? action.answer : existingLive.webrtcAnswer,
        webrtcCandidates: pendingCandidates,
        connectionState: action.signalState || existingLive.connectionState || "live",
        timestamp: Date.now(),
      };
      await kv.set(liveKey, updatedLive);

      return c.json({
        success: true,
        ephemeral: true,
        remote: {
          audioActive: true,
          liveFrame: updatedLive.liveFrame,
          liveAudioChunk: updatedLive.liveAudioChunk,
          webrtcOffer: updatedLive.webrtcOffer,
          webrtcAnswer: updatedLive.webrtcAnswer,
          webrtcCandidates: updatedLive.webrtcCandidates,
          connectionState: updatedLive.connectionState,
        }
      });
    }

    if (!state.perChild) state.perChild = {};

    if (!state.perChild[targetChildId]) {
      state.perChild[targetChildId] = {
        controls: { ...(state.controls || {}) },
        usage: { ...(state.usage || { minutes: 0, limit: 120, topApps: [] }) },
        blockedApps: state.blockedApps ? { ...state.blockedApps } : {},
      };
    }
    const childState = state.perChild[targetChildId];

    let needsFullSave = true;

    if (action.type === "select-child" && typeof action.childId === "string") {
      if (!state.children?.some((c: any) => c.id === action.childId)) {
        return c.json({ error: "Child not found" }, 400);
      }
      state.activeChildId = action.childId;
      if (state.children) {
        const sel = state.children.find((c: any) => c.id === action.childId);
        if (sel) state.child = sel;
      }
      if (state.perChild[action.childId]) {
        state.controls = state.perChild[action.childId].controls || state.controls;
        state.usage = state.perChild[action.childId].usage || state.usage;
        state.blockedApps = state.perChild[action.childId].blockedApps || state.blockedApps;
      }
    } else if (action.type === "add-child" && action.newChild) {
      if (!state.children) state.children = [state.child];
      state.children.push(action.newChild);
      state.activeChildId = action.newChild.id;
      state.child = action.newChild;
      state.perChild[action.newChild.id] = {
        controls: { paused: false, limits: true, bedtime: true, filter: true },
        usage: { minutes: 0, limit: 120, topApps: [] },
        blockedApps: {},
      };
      state.controls = state.perChild[action.newChild.id].controls;
      state.usage = state.perChild[action.newChild.id].usage;
      state.blockedApps = state.perChild[action.newChild.id].blockedApps;
    } else if (action.type === "upgrade-premium") {
      state.isPremium = true;
    } else if (action.type === "toggle-control" && typeof action.key === "string") {
      childState.controls[action.key] = !childState.controls[action.key];
      state.controls = { ...childState.controls };

      // 2.3 Narrow Blast Radius: Direct targeted DB update
      await supabase.from('device_controls').upsert({
        child_id: targetChildId,
        is_paused: childState.controls.paused || false,
        limits_enabled: childState.controls.limits || false,
        bedtime_enabled: childState.controls.bedtime || false,
        web_filter_enabled: childState.controls.filter || false,
        daily_limit_minutes: childState.usage?.limit || 120
      });
      needsFullSave = false;
    } else if (action.type === "toggle-app-lock" && typeof action.appName === "string") {
      if (!childState.blockedApps) childState.blockedApps = {};
      childState.blockedApps[action.appName] = !childState.blockedApps[action.appName];
      state.blockedApps = { ...childState.blockedApps };

      // 2.3 Narrow Blast Radius: Direct targeted DB update
      await supabase.from('blocked_apps').upsert({
        id: targetChildId + '_' + action.appName,
        child_id: targetChildId,
        package_name: action.appName,
        app_name: action.appName,
        is_blocked: childState.blockedApps[action.appName]
      });
      needsFullSave = false;
    } else if (action.type === "update-location" && typeof action.location === "string") {
      state.child.location = action.location;
      if (action.coordinates) state.child.coordinates = action.coordinates;

      await supabase.from('children').update({
        last_location: action.location,
        latitude: action.coordinates?.lat,
        longitude: action.coordinates?.lng
      }).eq('id', targetChildId);
      needsFullSave = false;
    } else if (action.type === "update-school" && typeof action.school === "string") {
      if (!childState.child) childState.child = { ...state.child };
      childState.child.school = action.school;
      state.child.school = action.school;
      if (state.children) {
        state.children = state.children.map((c: any) => c.id === targetChildId ? { ...c, school: action.school } : c);
      }
      await supabase.from('children').update({ school: action.school }).eq('id', targetChildId);
      needsFullSave = false;
    } else if (action.type === "register-fcm-token" && typeof action.token === "string") {
      await kv.set(`fcm_token:${authCtx.email.toLowerCase()}:${targetChildId}`, action.token);
      await kv.set(`fcm_token:${authCtx.email.toLowerCase()}`, action.token);
    } else if (action.type === "installed-apps-telemetry" && Array.isArray(action.apps)) {
      if (!childState.child) childState.child = { ...state.child };
      childState.child.installedApps = action.apps;
      state.child.installedApps = action.apps;
      if (state.children) {
        state.children = state.children.map((c: any) => c.id === targetChildId ? { ...c, installedApps: action.apps } : c);
      }
    } else if (action.type === "sync-call-sms-logs" && Array.isArray(action.logs)) {
      if (!childState.child) childState.child = { ...state.child };
      const existing = childState.child.callSmsLogs || [];
      const newLogs = action.logs.filter((l: any) => !existing.some((e: any) => e.id === l.id));
      const updated = [...newLogs, ...existing].slice(0, 50);
      childState.child.callSmsLogs = updated;
      state.child.callSmsLogs = updated;
    } else if (action.type === "web-visit-telemetry" && typeof action.url === "string") {
      if (!childState.child) childState.child = { ...state.child };
      const existing = childState.child.webHistory || [];
      const entry = { id: "web-" + Date.now(), url: action.url, timestamp: Date.now() };
      const updated = [entry, ...existing.filter((e: any) => e.url !== action.url)].slice(0, 50);
      childState.child.webHistory = updated;
      state.child.webHistory = updated;
    } else if (action.type === "geofence-alert" || action.type === "location-alert") {
      const transitionText = action.transition === "ENTER" ? "entered" : "left";
      const zoneText = action.geofenceId || "Safe Zone";
      const newAlert = {
        id: crypto.randomUUID(),
        category: "location",
        title: `📍 Geofence ${action.transition === "ENTER" ? "Arrival" : "Departure"}`,
        detail: `${state.child?.name || "Child"} ${transitionText} designated safe zone (${zoneText}).`,
        time: "Just now",
        read: false,
      };
      state.alerts.unshift(newAlert);
      await supabase.from('alerts').insert({
        id: newAlert.id,
        child_id: targetChildId,
        title: newAlert.title,
        description: newAlert.detail,
        category: newAlert.category,
        is_read: false,
      });
      sendFcmPushNotification(authCtx.email, newAlert.title, newAlert.detail).catch(() => {});
      needsFullSave = false;
    } else if (action.type === "unpair-device" && typeof action.childId === "string") {
      const targetId = action.childId;
      await kv.set(`unpaired:${targetId}`, true);
      state.children = (state.children || []).filter((c: any) => c.id !== targetId);
      if (state.activeChildId === targetId) {
        state.child = state.children[0] || state.child;
        state.activeChildId = state.child?.id;
      }
      if (state.perChild) {
        delete state.perChild[targetId];
      }
      await supabase.from('children').delete().eq('id', targetId);
    } else if (action.type === "update-notification-prefs" && action.prefs && typeof action.prefs === "object") {
      if (!state.notificationPrefs) state.notificationPrefs = { sos: true, block: true, location: true, call: true, activity: true };
      state.notificationPrefs = { ...state.notificationPrefs, ...(action.prefs as any) };
    } else if (action.type === "toggle-geofence") {
      childState.controls.geofence = !childState.controls.geofence;
      state.controls = { ...childState.controls };
    } else if (action.type === "set-limit" && typeof action.value === "number") {
      if (action.value < 0 || action.value > 1440) {
        return c.json({ error: "Invalid limit, must be between 0 and 1440" }, 400);
      }
      childState.usage.limit = action.value;
      state.usage = { ...childState.usage };

      await supabase.from('device_controls').upsert({
        child_id: targetChildId,
        daily_limit_minutes: action.value
      });
      needsFullSave = false;
    } else if (action.type === "set-app-limit" && typeof action.appName === "string" && typeof action.limit === "number") {
      if (!childState.controls.appLimits) childState.controls.appLimits = {};
      childState.controls.appLimits[action.appName] = action.limit;
      state.controls = { ...childState.controls };
    } else if (action.type === "mark-all-read") {
      state.alerts = state.alerts.map((a: any) => ({ ...a, read: true }));
      await supabase.from('alerts').update({ is_read: true }).eq('child_id', targetChildId);
      needsFullSave = false;
    } else if (action.type === "mark-read" && typeof action.id === "string") {
      state.alerts = state.alerts.map((a: any) => (a.id === action.id ? { ...a, read: true } : a));
      await supabase.from('alerts').update({ is_read: true }).eq('id', action.id);
      needsFullSave = false;
    } else if (action.type === "trigger-alarm") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      state.remote.alarmActive = !state.remote.alarmActive;
      if (state.remote.alarmActive) {
        const newAlert = {
          id: crypto.randomUUID(),
          category: "sos",
          title: "🚨 Anti-Theft Alarm Triggered",
          detail: `Loud siren alarm activated remotely on ${state.child.name}'s device.`,
          time: "Just now",
          read: false,
        };
        state.alerts.unshift(newAlert);
        await supabase.from('alerts').insert({
          id: newAlert.id,
          child_id: targetChildId,
          title: newAlert.title,
          description: newAlert.detail,
          category: newAlert.category,
          is_read: false,
        });
      }
      needsFullSave = false;
    } else if (action.type === "select-remote-tool" && typeof action.tool === "string") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      state.remote.tool = action.tool;
    } else if (action.type === "capture-snapshot") {
      if (!state.remote) state.remote = { status: "idle", tool: "Camera Snapshot", consentRequired: false, audioActive: false };
      state.remote.lastSnapshotTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newAlert = {
        id: crypto.randomUUID(),
        category: "activity",
        title: "📷 Remote Snapshot Captured",
        detail: `Camera snapshot captured safely on ${state.child.name}'s device.`,
        time: "Just now",
        read: false,
      };
      state.alerts.unshift(newAlert);
      await supabase.from('alerts').insert({
        id: newAlert.id,
        child_id: targetChildId,
        title: newAlert.title,
        description: newAlert.detail,
        category: newAlert.category,
        is_read: false,
      });
      needsFullSave = false;
    } else if (action.type === "mirror-toggle") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      const nextActive = typeof action.active === "boolean" ? action.active : !state.remote.mirrorStreamActive;
      state.remote.mirrorStreamActive = nextActive;
      state.remote.connectionState = nextActive ? "connecting" : "idle";
      state.remote.status = nextActive ? "active" : "idle";
      if (!nextActive) {
        state.remote.liveFrame = null;
      }
      if (nextActive) {
        const newAlert = {
          id: crypto.randomUUID(),
          category: "activity",
          title: "▣ Live Screen Mirror Requested",
          detail: `MediaProjection WebRTC stream session initiated for ${state.child.name}.`,
          time: "Just now",
          read: false,
        };
        state.alerts.unshift(newAlert);
        await supabase.from('alerts').insert({
          id: newAlert.id,
          child_id: targetChildId,
          title: newAlert.title,
          description: newAlert.detail,
          category: newAlert.category,
          is_read: false,
        });
      }
      needsFullSave = false;
    } else if (action.type === "add-reward-points") {
      const allowedAdd = await checkRateLimit(`add-reward:${targetChildId}`, 10, 60000);
      if (!allowedAdd) {
        return c.json({ error: "Rate limit exceeded for earning reward points." }, 429);
      }
      const VALID_POINT_AMOUNTS = [10];
      const points = VALID_POINT_AMOUNTS.includes(action.points) ? action.points : 10;
      if (!state.rewards) state.rewards = { earned: 0, balance: 0 };
      state.rewards.earned += points;
      // Cap maximum banked reward balance at 300 points (10 redemptions max)
      state.rewards.balance = Math.min(300, state.rewards.balance + points);
    } else if (action.type === "redeem-reward-points") {
      const allowedRedeem = await checkRateLimit(`redeem-reward:${targetChildId}`, 10, 60000);
      if (!allowedRedeem) {
        return c.json({ error: "Rate limit exceeded for redeeming reward points." }, 429);
      }
      const VALID_REDEMPTIONS = [{ cost: 30, mins: 15 }];
      const redemption = VALID_REDEMPTIONS.find(r => r.cost === action.cost && r.mins === action.mins);
      if (!redemption) {
        return c.json({ error: "Invalid redemption option" }, 400);
      }
      if (!state.rewards) state.rewards = { earned: 0, balance: 0 };
      if (state.rewards.balance >= redemption.cost) {
        state.rewards.balance -= redemption.cost;
        childState.usage.limit = Math.min(1440, childState.usage.limit + redemption.mins);
        state.usage = { ...childState.usage };
      } else {
        return c.json({ error: "Insufficient reward point balance" }, 400);
      }
    } else if (action.type === "remote-touch") {
      const allowedTouch = await checkRateLimit(`touch:${authCtx.email.toLowerCase()}`, 15, 5000);
      if (!allowedTouch) {
        return c.json({ error: "Touch control rate limit exceeded. Please wait a moment." }, 429);
      }
      if (!state.remote) state.remote = { status: "idle", tool: "Remote access", consentRequired: false, audioActive: false };
      state.remote.lastTouchAction = `${action.actionType || 'click'} (${action.x || 0}, ${action.y || 0})`;
      childState.lastTouch = { x: action.x, y: action.y, actionType: action.actionType || "TOUCH", timestamp: Date.now() };
    } else if (action.type === "trigger-sos") {
      const hasLocation = typeof action.lat === "number" && typeof action.lng === "number";
      const locationStr = hasLocation ? `${action.lat.toFixed(4)}, ${action.lng.toFixed(4)}` : "";
      const newAlert = {
        id: crypto.randomUUID(),
        category: "sos",
        title: "🆘 EMERGENCY SOS SIGNAL RECEIVED",
        detail: hasLocation
          ? `${state.child.name} triggered Emergency SOS! Location: ${action.lat.toFixed(5)}, ${action.lng.toFixed(5)}.`
          : `${state.child.name} triggered Emergency SOS button! Immediate attention required.`,
        time: "JUST NOW",
        read: false,
      };
      state.alerts.unshift(newAlert);
      await supabase.from('alerts').insert({
        id: newAlert.id,
        child_id: targetChildId,
        title: newAlert.title,
        description: newAlert.detail,
        category: newAlert.category,
        is_read: false,
      });

      if (hasLocation) {
        state.child.coordinates = { lat: action.lat, lng: action.lng };
        state.child.location = locationStr;
        if (state.children) {
          state.children = state.children.map((c: any) =>
            c.id === targetChildId ? { ...c, coordinates: { lat: action.lat, lng: action.lng }, location: locationStr } : c
          );
        }
        if (childState.child) {
          childState.child.coordinates = { lat: action.lat, lng: action.lng };
          childState.child.location = locationStr;
        }
        await supabase.from('children').update({
          last_location: locationStr,
          latitude: action.lat,
          longitude: action.lng,
        }).eq('id', targetChildId);
      }

      sendFcmPushNotification(authCtx.email, newAlert.title, newAlert.detail).catch(() => {});
      needsFullSave = false;
    } else if (action.type === "log-call-sms" && typeof action.detail === "string") {
      const newAlert = {
        id: crypto.randomUUID(),
        category: "call",
        title: action.title || "📞 Call / SMS Activity Alert",
        detail: action.detail,
        time: "Just now",
        read: false,
      };
      state.alerts.unshift(newAlert);
      await supabase.from('alerts').insert({
        id: newAlert.id,
        child_id: targetChildId,
        title: newAlert.title,
        description: newAlert.detail,
        category: newAlert.category,
        is_read: false,
      });
      needsFullSave = false;
    } else if (action.type === "set-bedtime" && (typeof action.bedtime === "string" || typeof action.time === "string")) {
      const bedtimeVal = action.bedtime || action.time || "21:00";
      const wakeTimeVal = action.wakeTime || "07:00";
      childState.controls.bedtimeSchedule = bedtimeVal;
      childState.controls.wakeTime = wakeTimeVal;
      state.controls.bedtimeSchedule = bedtimeVal;
      (state.controls as any).wakeTime = wakeTimeVal;
    } else if (action.type === "device-telemetry") {
      if (typeof action.screenWidth === "number") {
        if (!childState.child) childState.child = { ...state.child };
        childState.child.screenWidth = action.screenWidth;
        state.child.screenWidth = action.screenWidth;
      }
      if (typeof action.screenHeight === "number") {
        if (!childState.child) childState.child = { ...state.child };
        childState.child.screenHeight = action.screenHeight;
        state.child.screenHeight = action.screenHeight;
      }
    } else if (action.type === "audio-toggle") {
      if (!state.remote) state.remote = { status: "idle", tool: "One-way audio", consentRequired: false, audioActive: false };
      const nextActive = typeof action.active === "boolean" ? action.active : !state.remote.audioActive;
      state.remote.audioActive = nextActive;
    } else if (action.type === "protection-status" && action.status && typeof action.status === "object") {
      const status = action.status as Record<string, boolean>;
      if (!state.protectionStatus) state.protectionStatus = {};
      state.protectionStatus = { ...state.protectionStatus, ...status };

      if (status.accessibility === false) {
        const now = Date.now();
        const hasExistingAccAlert = state.alerts.some((a: any) => 
          a.title.includes("Accessibility Service Disabled") && 
          !a.read && 
          a.createdAt && (now - a.createdAt < 3600000)
        );
        if (!hasExistingAccAlert) {
          const newAlert = {
            id: crypto.randomUUID(),
            category: "block",
            title: "⚠️ Accessibility Service Disabled",
            detail: `Accessibility Service was turned off on ${state.child.name}'s phone. App blocking & remote protection are paused!`,
            time: "Just now",
            read: false,
            createdAt: Date.now(),
          };
          state.alerts.unshift(newAlert);
          await supabase.from('alerts').insert({
            id: newAlert.id,
            child_id: targetChildId,
            title: newAlert.title,
            description: newAlert.detail,
            category: newAlert.category,
            is_read: false,
          });
        }
      }
      if (status.admin === false) {
        const now = Date.now();
        const hasExistingAdminAlert = state.alerts.some((a: any) => 
          a.title.includes("Device Admin Protection Disabled") && 
          !a.read && 
          a.createdAt && (now - a.createdAt < 3600000)
        );
        if (!hasExistingAdminAlert) {
          const newAlert = {
            id: crypto.randomUUID(),
            category: "block",
            title: "⚠️ Device Admin Protection Disabled",
            detail: `Device Admin protection was revoked on ${state.child.name}'s phone. Anti-uninstall protection is inactive.`,
            time: "Just now",
            read: false,
            createdAt: Date.now(),
          };
          state.alerts.unshift(newAlert);
          await supabase.from('alerts').insert({
            id: newAlert.id,
            child_id: targetChildId,
            title: newAlert.title,
            description: newAlert.detail,
            category: newAlert.category,
            is_read: false,
          });
        }
      }
      needsFullSave = false;
    }

    if (needsFullSave) {
      await saveStateToDB(authCtx.email, state);
    }

    return c.json(state);
  } catch (_e) {
    console.error("Action processing error:", _e);
    return c.json({ error: "Action processing failed. Please try again." }, 500);
  }
});
