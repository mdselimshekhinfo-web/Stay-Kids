import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { hashPassword, verifyPassword, signJwt, verifyJwt, signDeviceJwt } from "./security.ts";
import { createClient } from "npm:@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function getProfile(email: string) {
  const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single();
  if (data) return data;
  const { data: newProfile } = await supabase.from('profiles').insert({ email: email.toLowerCase(), full_name: email.split('@')[0] }).select().single();
  return newProfile;
}

async function getStateFromDB(email: string) {
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
        battery: ch.battery_level,
        online: ch.is_online,
        coordinates: { lat: ch.latitude, lng: ch.longitude }
      }));
      state.child = state.children[0];
      state.activeChildId = state.child.id;
      
      state.perChild = {};
      for (const ch of children) {
        const { data: controls } = await supabase.from('device_controls').select('*').eq('child_id', ch.id).single();
        const { data: usage } = await supabase.from('app_usage').select('*').eq('child_id', ch.id).order('date', { ascending: false }).limit(1).single();
        const { data: alerts } = await supabase.from('alerts').select('*').eq('child_id', ch.id);
        const { data: blockedApps } = await supabase.from('blocked_apps').select('*').eq('child_id', ch.id);
        const { data: history } = await supabase.from('daily_usage_logs').select('*').eq('child_id', ch.id).order('date', { ascending: false }).limit(30);

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
          history: history || []
        } : { ...state.usage, history: history || [] };
        
        const chBlockedApps = blockedApps ? blockedApps.reduce((acc: any, curr: any) => ({...acc, [curr.package_name]: curr.is_blocked}), {}) : {};

        state.perChild[ch.id] = {
          controls: chControls,
          usage: chUsage,
          blockedApps: chBlockedApps,
        };
      }
      
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

async function saveStateToDB(email: string, state: any) {
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
        for (const [pkg, blocked] of Object.entries(perCh.blockedApps)) {
          await supabase.from('blocked_apps').upsert({
            id: ch.id + '_' + pkg,
            child_id: ch.id,
            package_name: pkg,
            app_name: pkg,
            is_blocked: blocked
          });
        }
      }
    }
  } catch(e) {
    console.error('Failed to save to DB', e);
  }
}


const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Allowed CORS Origins
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8443",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  "http://localhost",
];

// Enable Hardened CORS Middleware
app.use(
  "/*",
  cors({
    origin: (origin) => {
      const allowedOrigins = ["capacitor://localhost", "http://localhost:8443", "http://localhost:5173"];
      const reqOrigin = origin || "";
      const corsOrigin = allowedOrigins.includes(reqOrigin) ? reqOrigin : allowedOrigins[0];
      return corsOrigin;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Rate Limiter Helper
async function checkRateLimit(ipOrEmail: string, limit = 5, windowMs = 60000): Promise<boolean> {
  try {
    const key = `ratelimit:${ipOrEmail.toLowerCase()}`;
    const record = (await kv.get(key)) || { count: 0, expiresAt: Date.now() + windowMs };
    if (Date.now() > record.expiresAt) {
      record.count = 1;
      record.expiresAt = Date.now() + windowMs;
    } else {
      record.count += 1;
    }
    await kv.set(key, record);
    return record.count <= limit;
  } catch (_e) {
    return true;
  }
}

// Unified Auth Helper for Parent & Device Tokens
async function getAuthContext(c: any): Promise<{ isDevice: boolean; email: string; deviceId?: string; childId?: string; name?: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const payload = await verifyJwt(token);
  if (!payload) return null;
  if (payload.type === "device" && payload.parentEmail) {
    return {
      isDevice: true,
      email: payload.parentEmail.toLowerCase(),
      deviceId: payload.deviceId,
      childId: payload.childId,
    };
  }
  if (payload.email) {
    return { isDevice: false, email: payload.email.toLowerCase(), name: payload.name || payload.email.split("@")[0] };
  }
  return null;
}

// Parent-only Auth Middleware
async function getAuthenticatedUser(c: any): Promise<{ email: string; name: string } | null> {
  const ctx = await getAuthContext(c);
  if (!ctx || ctx.isDevice) return null;
  return { email: ctx.email, name: ctx.name || ctx.email.split("@")[0] };
}

const defaultState = {
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


async function sendRealEmailOtp(email: string, otp: string, type: "signup" | "reset" = "signup") {
  const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!resendApiKey) {
    console.log(`[STAYKIDS OTP CODE FOR ${email}]: ${otp}`);
    return false;
  }

  try {
    const subject = type === "signup" 
      ? `StayKids Security Code: ${otp}` 
      : `Reset Your StayKids Password: ${otp}`;
      
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e1e8e5; border-radius: 20px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #287555; margin: 0; font-size: 24px;">stay<span style="color: #17352b;">kids</span></h2>
          <p style="color: #687b74; font-size: 13px; margin-top: 4px;">Parental Control & Digital Safety</p>
        </div>
        <p style="color: #172226; font-size: 14px; line-height: 1.5;">Hello,</p>
        <p style="color: #556660; font-size: 14px; line-height: 1.5;">Your 6-digit verification OTP code for StayKids ${type === "signup" ? "Account Setup" : "Password Reset"} is:</p>
        <div style="background-color: #f3faee; padding: 18px; border-radius: 16px; text-align: center; margin: 20px 0; border: 1px dashed #287555;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #17352b; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #71807a; font-size: 12px; text-align: center; margin-top: 20px;">This code is valid for 5 minutes. Do not share this code with anyone.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StayKids Security <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    return res.ok;
  } catch (e) {
    console.error("Resend Email OTP Failed:", e);
    return false;
  }
}

// Auth Sign Up Endpoint - Initiates Real Email OTP Verification
app.post("/server/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password } = body || {};
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const allowed = await checkRateLimit(email, 5, 60000);
    if (!allowed) {
      return c.json({ error: "Too many registration attempts. Please try again in 1 minute." }, 429);
    }

    const { data: existing } = await supabase.from('profiles').select('email').eq('email', email.toLowerCase()).single();
    if (existing) {
      return c.json({ error: "Account already exists with this email address." }, 400);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await hashPassword(password);
    
    const pendingKey = `pending:${email.toLowerCase()}`;
    await kv.set(pendingKey, {
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await sendRealEmailOtp(email.toLowerCase(), otp, "signup");

    return c.json({
      success: true,
      requiresOtp: true,
      email: email.toLowerCase(),
      message: `A 6-digit verification OTP code has been sent to ${email}.`,
    });
  } catch (_e) {
    return c.json({ error: "Failed to initiate registration" }, 500);
  }
});

// Auth Verify Email OTP Endpoint
app.post("/server/auth/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp } = body || {};
    if (!email || !otp) {
      return c.json({ error: "Email and 6-digit OTP code are required" }, 400);
    }

    const verifyRateKey = `verify-otp:${email.toLowerCase()}`;
    const allowed = await checkRateLimit(verifyRateKey, 5, 15 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many verification attempts. Try again in 15 minutes." }, 429);
    }

    const pendingKey = `pending:${email.toLowerCase()}`;
    const pending = await kv.get(pendingKey);
    if (!pending) {
      return c.json({ error: "No pending registration found or OTP expired. Please signup again." }, 400);
    }

    if (Date.now() > pending.expiresAt) {
      await kv.set(pendingKey, null);
      return c.json({ error: "OTP code has expired (valid for 5 minutes). Please request a new code." }, 400);
    }

    if (pending.otp !== otp.trim()) {
      return c.json({ error: "Invalid 6-digit OTP verification code. Please check your email and try again." }, 400);
    }

    const { data: user, error: insertError } = await supabase.from('profiles').insert({
      email: pending.email,
      full_name: pending.name,
      password_hash: pending.password,
    }).select().single();

    if (insertError) {
      return c.json({ error: "Failed to create account" }, 500);
    }

    await kv.set(pendingKey, null);

    const token = await signJwt({ email: user.email, name: user.full_name });

    return c.json({ success: true, user, token, message: "Email successfully verified! Welcome to StayKids." });
  } catch (_e) {
    return c.json({ error: "OTP verification failed" }, 500);
  }
});

// Forgot Password - Send Reset OTP Endpoint
app.post("/server/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body || {};
    if (!email) return c.json({ error: "Email is required" }, 400);

    const allowed = await checkRateLimit(`forgot-pwd:${email.toLowerCase()}`, 3, 10 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many password reset requests. Please wait 10 minutes before requesting again." }, 429);
    }

    const { data: user } = await supabase.from('profiles').select('email').eq('email', email.toLowerCase()).single();
    if (!user) {
      return c.json({ error: "No registered account found with this email address." }, 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetKey = `reset:${email.toLowerCase()}`;
    await kv.set(resetKey, {
      email: email.toLowerCase(),
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await sendRealEmailOtp(email.toLowerCase(), otp, "reset");

    return c.json({
      success: true,
      email: email.toLowerCase(),
      message: `A 6-digit password reset OTP has been sent to ${email}`,
    });
  } catch (_e) {
    return c.json({ error: "Failed to process forgot password request" }, 500);
  }
});

// Confirm Password Reset with OTP Endpoint
app.post("/server/auth/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp, newPassword } = body || {};
    if (!email || !otp || !newPassword) {
      return c.json({ error: "Email, OTP code, and new password are required." }, 400);
    }

    const allowed = await checkRateLimit(`reset-pwd:${email.toLowerCase()}`, 10, 5 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many password reset attempts. Please wait 5 minutes." }, 429);
    }

    const resetKey = `reset:${email.toLowerCase()}`;
    const resetRecord = await kv.get(resetKey);
    if (!resetRecord) {
      return c.json({ error: "No reset request found or OTP expired. Please request password reset again." }, 400);
    }

    if (Date.now() > resetRecord.expiresAt) {
      await kv.set(resetKey, null);
      return c.json({ error: "Password reset OTP code expired. Please request a new code." }, 400);
    }

    if (resetRecord.otp !== otp.trim()) {
      return c.json({ error: "Invalid 6-digit OTP code." }, 400);
    }

    const { data: user } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single();
    if (!user) return c.json({ error: "Account not found." }, 404);

    // Hash New Password with PBKDF2
    const hashedPassword = await hashPassword(newPassword);
    await supabase.from('profiles').update({ password_hash: hashedPassword }).eq('email', email.toLowerCase());
    await kv.set(resetKey, null); // Clear reset record

    const token = await signJwt({ email: user.email, name: user.full_name });

    return c.json({
      success: true,
      user: { name: user.full_name, email: user.email },
      token,
      message: "Password reset successful! You are now logged in.",
    });
  } catch (_e) {
    return c.json({ error: "Failed to reset password" }, 500);
  }
});

// Auth Resend OTP Endpoint
app.post("/server/auth/resend-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body || {};
    if (!email) return c.json({ error: "Email is required" }, 400);

    const allowed = await checkRateLimit(`resend-otp:${email.toLowerCase()}`, 3, 10 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many OTP resend requests. Please wait 10 minutes before requesting again." }, 429);
    }

    const pendingKey = `pending:${email.toLowerCase()}`;
    const pending = await kv.get(pendingKey);
    if (!pending) {
      return c.json({ error: "No pending registration found. Please sign up." }, 400);
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otp = newOtp;
    pending.expiresAt = Date.now() + 5 * 60 * 1000;
    await kv.set(pendingKey, pending);

    await sendRealEmailOtp(email.toLowerCase(), newOtp, "signup");

    return c.json({ success: true, message: `New 6-digit OTP code sent to ${email}` });
  } catch (_e) {
    return c.json({ error: "Failed to resend OTP" }, 500);
  }
});

// Auth Login Endpoint
app.post("/server/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body || {};
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const allowed = await checkRateLimit(email, 5, 60000);
    if (!allowed) {
      return c.json({ error: "Too many login attempts. Please wait 1 minute before trying again." }, 429);
    }

    const { data: user } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single();
    if (!user || !user.password_hash) {
      return c.json({ error: "Invalid email address or password." }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return c.json({ error: "Invalid email address or password." }, 401);
    }

    const token = await signJwt({ email: user.email, name: user.full_name });

    return c.json({ success: true, user: { name: user.full_name, email: user.email }, token });
  } catch (_e) {
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// Pairing Code Generation Endpoint
app.post("/server/pairing/generate", async (c) => {
  try {
    const authUser = await getAuthenticatedUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const targetChildId = body?.childId || "child-1";

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    await kv.set(`pairing:${pin}`, {
      active: true,
      parentId: authUser.email,
      childId: targetChildId,
      createdAt: Date.now(),
    });
    return c.json({ pin, qrCode: `SK-PAIR-${pin}` });
  } catch (_e) {
    return c.json({ error: "Failed to generate pairing code" }, 500);
  }
});

// Device Claim Endpoint
app.post("/server/pairing/claim", async (c) => {
  try {
    const body = await c.req.json();
    const { pin, deviceName } = body || {};
    if (!pin || pin.length !== 6) {
      return c.json({ error: "Please enter a valid 6-digit PIN code." }, 400);
    }

    const ip = c.req.header("x-forwarded-for") || "unknown";
    const allowed = await checkRateLimit(`pairing-claim:${ip}`, 5, 5 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many pairing attempts. Please wait 5 minutes." }, 429);
    }
    
    const pairing = await kv.get(`pairing:${pin}`);
    if (!pairing || !pairing.active) {
      return c.json({ error: "Invalid or already claimed pairing PIN. Please generate a new code from the Parent app." }, 400);
    }

    const PAIRING_EXPIRY_MS = 10 * 60 * 1000;
    if (Date.now() - pairing.createdAt > PAIRING_EXPIRY_MS) {
      await kv.set(`pairing:${pin}`, { active: false, expired: true });
      return c.json({ error: "Pairing PIN has expired (valid for 10 minutes). Please request a new code from the Parent app." }, 400);
    }

    const parentEmail = pairing.parentId || pairing.parentEmail || "parent@staykids.family";
    const targetChildId = pairing.childId || "child-1";
    await kv.set(`pairing:${pin}`, {
      active: false,
      parentId: parentEmail,
      childId: targetChildId,
      claimedBy: deviceName || "Child Device",
      claimedAt: Date.now(),
    });

    const deviceToken = await signDeviceJwt({
      parentEmail,
      deviceId: String(Date.now()),
      deviceName: deviceName || "Child Device",
      childId: targetChildId,
    });
    
    return c.json({
      success: true,
      message: "Device successfully paired!",
      parentId: parentEmail,
      deviceToken,
    });
  } catch (_e) {
    return c.json({ error: "Device claim failed" }, 500);
  }
});

// Health check endpoint
app.get("/server/health", (c) => {
  return c.json({ status: "ok" });
});

// GET state endpoint (Accepts Parent Token & Device Token)
app.get("/server/state", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }
    const parentStateKey = `state:${authCtx.email.toLowerCase()}`;
    const state = await getStateFromDB(authCtx.email);
    if (!state) return c.json(JSON.parse(JSON.stringify(defaultState)));
    return c.json(state);
  } catch (_e) {
    return c.json({ error: "Failed to load state" }, 500);
  }
});

// POST action endpoint for real-time state mutation & persistence (with Per-Child & Token Scoping)
app.post("/server/action", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }

    const action = await c.req.json();
    const parentStateKey = `state:${authCtx.email.toLowerCase()}`;

    const DEVICE_ALLOWED_ACTIONS = [
      "protection-status", "trigger-sos", "audio-chunk",
      "webrtc-signal", "capture-snapshot", "audio-toggle"
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

    if (!state.perChild) state.perChild = {};

    // For device tokens, force targetChildId to be token's embedded childId (preventing cross-child data mutation)
    // Backward compatibility: fallback to activeChildId or "child-1" for legacy device tokens
    const targetChildId = authCtx.isDevice
      ? (authCtx.childId || state.activeChildId || state.child?.id || "child-1")
      : (action.childId || state.activeChildId || state.child?.id || "child-1");

    if (!state.perChild[targetChildId]) {
      state.perChild[targetChildId] = {
        controls: { ...(state.controls || {}) },
        usage: { ...(state.usage || { minutes: 0, limit: 120, topApps: [] }) },
        blockedApps: state.blockedApps ? { ...state.blockedApps } : {},
      };
    }
    const childState = state.perChild[targetChildId];

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
    } else if (action.type === "toggle-app-lock" && typeof action.appName === "string") {
      if (!childState.blockedApps) childState.blockedApps = {};
      childState.blockedApps[action.appName] = !childState.blockedApps[action.appName];
      state.blockedApps = { ...childState.blockedApps };
    } else if (action.type === "update-location" && typeof action.location === "string") {
      state.child.location = action.location;
      if (action.coordinates) state.child.coordinates = action.coordinates;
    } else if (action.type === "toggle-geofence") {
      childState.controls.geofence = !childState.controls.geofence;
      state.controls = { ...childState.controls };
    } else if (action.type === "set-limit" && typeof action.value === "number") {
      if (action.value < 0 || action.value > 1440) {
        return c.json({ error: "Invalid limit, must be between 0 and 1440" }, 400);
      }
      childState.usage.limit = action.value;
      state.usage = { ...childState.usage };
    } else if (action.type === "mark-all-read") {
      state.alerts = state.alerts.map((a: any) => ({ ...a, read: true }));
    } else if (action.type === "mark-read" && typeof action.id === "string") {
      state.alerts = state.alerts.map((a: any) => (a.id === action.id ? { ...a, read: true } : a));
    } else if (action.type === "trigger-alarm") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      state.remote.alarmActive = !state.remote.alarmActive;
      if (state.remote.alarmActive) {
        state.alerts.unshift({
          id: String(Date.now()),
          category: "security",
          title: "🚨 Anti-Theft Alarm Triggered",
          detail: `Loud siren alarm activated remotely on ${state.child.name}'s device.`,
          time: "Just now",
          read: false,
        });
      }
    } else if (action.type === "select-remote-tool" && typeof action.tool === "string") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      state.remote.tool = action.tool;
    } else if (action.type === "capture-snapshot") {
      if (!state.remote) state.remote = { status: "idle", tool: "Camera Snapshot", consentRequired: false, audioActive: false };
      state.remote.lastSnapshotTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      state.alerts.unshift({
        id: String(Date.now()),
        category: "security",
        title: "📷 Remote Snapshot Captured",
        detail: `Camera snapshot captured safely on ${state.child.name}'s device.`,
        time: "Just now",
        read: false,
      });
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
        state.alerts.unshift({
          id: String(Date.now()),
          category: "activity",
          title: "▣ Live Screen Mirror Requested",
          detail: `MediaProjection WebRTC stream session initiated for ${state.child.name}.`,
          time: "Just now",
          read: false,
        });
      }
    } else if (action.type === "add-reward-points" && typeof action.points === "number") {
      if (!state.rewards) state.rewards = { earned: 0, balance: 0 };
      state.rewards.earned += action.points;
      state.rewards.balance += action.points;
    } else if (action.type === "redeem-reward-points" && typeof action.cost === "number" && typeof action.mins === "number") {
      if (!state.rewards) state.rewards = { earned: 0, balance: 0 };
      if (state.rewards.balance >= action.cost) {
        state.rewards.balance -= action.cost;
        childState.usage.limit += action.mins;
        state.usage = { ...childState.usage };
      }
    } else if (action.type === "remote-touch") {
      const allowedTouch = await checkRateLimit(`touch:${authCtx.email.toLowerCase()}`, 15, 5000);
      if (!allowedTouch) {
        return c.json({ error: "Touch control rate limit exceeded. Please wait a moment." }, 429);
      }
      if (!state.remote) state.remote = { status: "idle", tool: "Remote access", consentRequired: false, audioActive: false };
      state.remote.lastTouchAction = `${action.actionType || 'click'} (${action.x || 0}, ${action.y || 0})`;
      childState.lastTouch = { x: action.x, y: action.y, actionType: action.actionType || "TOUCH", timestamp: Date.now() };
    } else if (action.type === "webrtc-signal") {
      if (!state.remote) state.remote = { status: "idle", tool: "Screen Mirror", consentRequired: false, audioActive: false };
      if (action.signalState) {
        state.remote.connectionState = action.signalState; // "idle" | "requesting-consent" | "connecting" | "live" | "denied" | "disconnected"
      }
      if (action.frame) {
        state.remote.liveFrame = action.frame;
        state.remote.connectionState = "live";
      }
      if (action.signal) {
        childState.signals = childState.signals || [];
        childState.signals.push({ signal: action.signal, sender: action.sender || "parent", timestamp: Date.now() });
        if (childState.signals.length > 20) childState.signals.shift();
      }
    } else if (action.type === "trigger-sos") {
      state.alerts.unshift({
        id: String(Date.now()),
        category: "sos",
        title: "🆘 EMERGENCY SOS SIGNAL RECEIVED",
        detail: `${state.child.name} triggered Emergency SOS button! Immediate attention required.`,
        time: "JUST NOW",
        read: false,
      });
    } else if (action.type === "log-call-sms" && typeof action.detail === "string") {
      state.alerts.unshift({
        id: String(Date.now()),
        category: "activity",
        title: action.title || "📞 Call / SMS Activity Alert",
        detail: action.detail,
        time: "Just now",
        read: false,
      });
    } else if (action.type === "set-bedtime" && typeof action.bedtime === "string") {
      childState.controls.bedtimeSchedule = action.bedtime;
      state.controls.bedtimeSchedule = action.bedtime;
    } else if (action.type === "audio-chunk") {
      if (!state.remote) state.remote = { status: "idle", tool: "One-way audio", consentRequired: false, audioActive: false };
      state.remote.liveAudioChunk = action.chunk;
      state.remote.audioActive = true;
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
          (now - parseInt(a.id.split('-').pop() || "0") < 3600000)
        );
        if (!hasExistingAccAlert) {
          state.alerts.unshift({
            id: "alert-acc-" + Date.now(),
            category: "security",
            title: "⚠️ Accessibility Service Disabled",
            detail: `Accessibility Service was turned off on ${state.child.name}'s phone. App blocking & remote protection are paused!`,
            time: "Just now",
            read: false,
          });
        }
      }
      if (status.admin === false) {
        const now = Date.now();
        const hasExistingAdminAlert = state.alerts.some((a: any) => 
          a.title.includes("Device Admin Protection Disabled") && 
          !a.read && 
          (now - parseInt(a.id.split('-').pop() || "0") < 3600000)
        );
        if (!hasExistingAdminAlert) {
          state.alerts.unshift({
            id: "alert-admin-" + Date.now(),
            category: "security",
            title: "⚠️ Device Admin Protection Disabled",
            detail: `Device Admin protection was revoked on ${state.child.name}'s phone. Anti-uninstall protection is inactive.`,
            time: "Just now",
            read: false,
          });
        }
      }
    }

    await kv.set(parentStateKey, state);
    await saveStateToDB(authCtx.email, state);

    return c.json(state);
  } catch (_e) {
    return c.json(JSON.parse(JSON.stringify(defaultState)));
  }
});

// 3. KV Store Cleanup Job Endpoint
app.all("/kv/cleanup", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    const cleanupSecret = Deno.env.get("KV_CLEANUP_SECRET");

    if (cleanupSecret && c.req.header("X-Cleanup-Secret") !== cleanupSecret) {
      const user = await getAuthenticatedUser(c);
      if (!user && !authHeader) {
        return c.json({ error: "Unauthorized cleanup request" }, 401);
      }
    }

    const now = Date.now();
    const keysToDelete: string[] = [];

    // 1. Cleanup expired ratelimit records
    const ratelimits = await kv.getByPrefixEntries("ratelimit:");
    for (const item of ratelimits) {
      if (item.value && item.value.expiresAt && now > item.value.expiresAt) {
        keysToDelete.push(item.key);
      }
    }

    // 2. Cleanup expired/claimed pairing PIN records older than 24 hours
    const pairings = await kv.getByPrefixEntries("pairing:");
    for (const item of pairings) {
      if (!item.value) {
        keysToDelete.push(item.key);
        continue;
      }
      const isClaimedOrInactive = item.value.active === false;
      const isOlderThan24h = item.value.createdAt && (now - item.value.createdAt > 24 * 60 * 60 * 1000);
      if (isClaimedOrInactive || isOlderThan24h) {
        keysToDelete.push(item.key);
      }
    }

    // 3. Cleanup expired pending signup OTP records
    const pendings = await kv.getByPrefixEntries("pending:");
    for (const item of pendings) {
      if (item.value && item.value.expiresAt && now > item.value.expiresAt) {
        keysToDelete.push(item.key);
      }
    }

    // 4. Cleanup expired password reset OTP records
    const resets = await kv.getByPrefixEntries("reset:");
    for (const item of resets) {
      if (item.value && item.value.expiresAt && now > item.value.expiresAt) {
        keysToDelete.push(item.key);
      }
    }

    // Execute bulk deletion using existing kv.mdel helper
    if (keysToDelete.length > 0) {
      await kv.mdel(keysToDelete);
    }

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      deletedCount: keysToDelete.length,
      deletedKeys: keysToDelete,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "KV cleanup failed" }, 500);
  }
});

Deno.serve(app.fetch);
