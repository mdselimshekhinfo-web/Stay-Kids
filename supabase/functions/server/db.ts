import * as kv from "./kv_store.tsx";
import { hashPassword, verifyPassword, signJwt, verifyJwt, signDeviceJwt, checkRateLimit } from "./security.ts";
import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://ewsehvgwzczlshyoyhqf.supabase.co";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTA2MjIsImV4cCI6MjA5OTY4NjYyMn0.kWqk1d-8mNt3mG5zwfaRC9RUgZt7WgEyRNrqn7frn-s";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getProfile(email: string) {
  const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (data) return data;
  const { data: newProfile } = await supabase.from('profiles').insert({ email: email.toLowerCase(), full_name: email.split('@')[0] }).select().single();
  return newProfile;
}

// Optimized getStateFromDB with batched concurrent queries (N+1 pattern eliminated)
export async function getStateFromDB(email: string) {
  try {
    const profile = await getProfile(email);
    if (!profile) return JSON.parse(JSON.stringify(defaultState));

    const { data: children } = await supabase.from('children').select('*').eq('parent_id', profile.id);
    const state = JSON.parse(JSON.stringify(defaultState));

    if (children && children.length > 0) {
      state.children = children.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        device: ch.device_name,
        location: ch.last_location,
        school: ch.school || undefined,
        battery: ch.battery_level,
        online: ch.is_online,
        coordinates: { lat: ch.latitude, lng: ch.longitude }
      }));
      state.child = state.children[0];
      state.activeChildId = state.child.id;
      state.perChild = {};

      const childIds = children.map((ch: any) => ch.id);

      // Execute queries concurrently for all children in 1 round-trip batch
      const [controlsRes, usageRes, alertsRes, blockedRes, historyRes] = await Promise.all([
        supabase.from('device_controls').select('*').in('child_id', childIds),
        supabase.from('app_usage').select('*').in('child_id', childIds),
        supabase.from('alerts').select('*').in('child_id', childIds).order('created_at', { ascending: false }).limit(50),
        supabase.from('blocked_apps').select('*').in('child_id', childIds),
        supabase.from('daily_usage_logs').select('*').in('child_id', childIds).order('date', { ascending: false }).limit(30),
      ]);

      const controlsMap = new Map((controlsRes.data || []).map((c: any) => [c.child_id, c]));
      const usageMap = new Map((usageRes.data || []).map((u: any) => [u.child_id, u]));
      
      const alertsByChild = new Map<string, any[]>();
      (alertsRes.data || []).forEach((a: any) => {
        const list = alertsByChild.get(a.child_id) || [];
        list.push(a);
        alertsByChild.set(a.child_id, list);
      });

      const blockedByChild = new Map<string, any[]>();
      (blockedRes.data || []).forEach((b: any) => {
        const list = blockedByChild.get(b.child_id) || [];
        list.push(b);
        blockedByChild.set(b.child_id, list);
      });

      const historyByChild = new Map<string, any[]>();
      (historyRes.data || []).forEach((h: any) => {
        const list = historyByChild.get(h.child_id) || [];
        list.push(h);
        historyByChild.set(h.child_id, list);
      });

      const allAlerts: any[] = [];

      for (const ch of children) {
        const controls = controlsMap.get(ch.id);
        const usage = usageMap.get(ch.id);
        const alerts = alertsByChild.get(ch.id) || [];
        const blockedApps = blockedByChild.get(ch.id) || [];
        const history = historyByChild.get(ch.id) || [];

        const chControls = controls ? {
          paused: controls.is_paused,
          limits: controls.limits_enabled,
          bedtime: controls.bedtime_enabled,
          filter: controls.web_filter_enabled
        } : state.controls;

        const chUsage = usage ? {
          minutes: usage.total_minutes,
          limit: controls?.daily_limit_minutes || 120,
          topApps: usage.top_apps || [],
          history: history
        } : { ...state.usage, history: history };
        
        const chBlockedApps = blockedApps.reduce((acc: any, curr: any) => ({...acc, [curr.package_name]: curr.is_blocked}), {});

        alerts.forEach((a: any) => {
          allAlerts.push({
            id: a.id,
            category: a.category || "activity",
            title: a.title || "Notification",
            detail: a.description || a.detail || "",
            time: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
            read: !!a.is_read,
          });
        });

        state.perChild[ch.id] = {
          controls: chControls,
          usage: chUsage,
          blockedApps: chBlockedApps,
        };
      }

      state.alerts = allAlerts; // Already sorted by created_at DESC from DB query (line 49)
      
      const activeData = state.perChild[state.activeChildId];
      if (activeData) {
         state.controls = activeData.controls;
         state.usage = activeData.usage;
         state.blockedApps = activeData.blockedApps;
      }
    }
    return state;
  } catch(e) {
    console.error("DB Error:", e);
    throw new Error("Failed to fetch state from DB");
  }
}

export async function saveStateToDB(email: string, state: any) {
  try {
    const profile = await getProfile(email);
    if (!profile || !state.children) return;

    for (const ch of state.children) {
      const perCh = state.perChild?.[ch.id];
      if (!perCh) continue;

      await supabase.from('children').upsert({
        id: ch.id,
        parent_id: profile.id,
        name: ch.name,
        device_name: ch.device,
        battery_level: ch.battery,
        is_online: ch.online,
        last_location: ch.location,
        latitude: ch.coordinates?.lat,
        longitude: ch.coordinates?.lng
      });

      await supabase.from('device_controls').upsert({
        child_id: ch.id,
        is_paused: perCh.controls?.paused || false,
        limits_enabled: perCh.controls?.limits || false,
        bedtime_enabled: perCh.controls?.bedtime || false,
        web_filter_enabled: perCh.controls?.filter || false,
        daily_limit_minutes: perCh.usage?.limit || 120
      });

      if (perCh.blockedApps) {
        const blockedRows = Object.entries(perCh.blockedApps).map(([pkg, blocked]) => ({
          id: ch.id + '_' + pkg,
          child_id: ch.id,
          package_name: pkg,
          app_name: pkg,
          is_blocked: blocked
        }));
        if (blockedRows.length > 0) {
          await supabase.from('blocked_apps').upsert(blockedRows);
        }
      }
    }

    // Persist active alerts to database
    if (state.alerts && Array.isArray(state.alerts)) {
      const alertRows = state.alerts.slice(0, 20).map((alert: any) => ({
        id: alert.id,
        child_id: state.activeChildId || state.child?.id || "child-1",
        title: alert.title,
        description: alert.detail || alert.description || "",
        category: alert.category || "activity",
        is_read: !!alert.read,
      }));
      if (alertRows.length > 0) {
        await supabase.from('alerts').upsert(alertRows);
      }
    }
  } catch(e) {
    console.error('Failed to save to DB', e);
  }
}

// Email Format Validator Helper
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Unified Auth Helper for Parent & Device Tokens
export async function getAuthContext(c: any): Promise<{ isDevice: boolean; email: string; deviceId?: string; childId?: string; name?: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const payload = await verifyJwt(token);
  if (!payload) return null;
  if (payload.type === "device" && payload.parentEmail) {
    if (payload.childId) {
      const isUnpaired = await kv.get(`unpaired:${payload.childId}`);
      if (isUnpaired) return null;
    }
    return {
      isDevice: true,
      email: payload.parentEmail.toLowerCase(),
      deviceId: payload.deviceId,
      childId: payload.childId,
    };
  }
  if (payload.email) {
    const parentEmail = payload.email.toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('token_valid_after').eq('email', parentEmail).maybeSingle();
    if (profile && profile.token_valid_after && payload.iat) {
      const validAfterSec = Math.floor(new Date(profile.token_valid_after).getTime() / 1000);
      if (payload.iat < validAfterSec) {
        return null; // JWT issued before token_valid_after timestamp -> Invalid/Revoked token
      }
    }
    return { isDevice: false, email: parentEmail, name: payload.name || parentEmail.split("@")[0] };
  }
  return null;
}

// Parent-only Auth Middleware
export async function getAuthenticatedUser(c: any): Promise<{ email: string; name: string } | null> {
  const ctx = await getAuthContext(c);
  if (!ctx || ctx.isDevice) return null;
  return { email: ctx.email, name: ctx.name || ctx.email.split("@")[0] };
}

export const defaultState = {
  child: {
    name: "Child",
    device: "Android Device",
    location: "Unknown",
    battery: 100,
    online: true,
    protected: true,
  },
  usage: {
    minutes: 0,
    limit: 120,
    topApps: [],
  },
  controls: {
    paused: false,
    limits: true,
    bedtime: true,
    filter: true,
  },
  rewards: {
    earned: 0,
    balance: 0,
  },
  alerts: [],
  remote: {
    status: "idle",
    tool: "Screen Mirror",
    consentRequired: false,
    audioActive: false,
  },
  isPremium: true,
};
