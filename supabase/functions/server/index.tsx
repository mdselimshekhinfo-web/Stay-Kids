import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { hashPassword, verifyPassword, signJwt, verifyJwt, signDeviceJwt } from "./security.ts";

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
      if (!origin) return "*";
      if (ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed))) {
        return origin;
      }
      return null;
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
    name: "Mia",
    device: "Galaxy Tab A8",
    location: "Greenfield School",
    battery: 84,
    online: true,
    protected: true,
  },
  usage: {
    minutes: 102,
    limit: 180,
    topApps: ["YouTube", "Roblox", "Chrome"],
  },
  controls: {
    paused: false,
    limits: true,
    bedtime: true,
    filter: true,
  },
  rewards: {
    earned: 45,
    balance: 15,
  },
  alerts: [
    { id: "1", title: "Screen time nearly used", detail: "Mia has 18 minutes remaining today.", time: "5 min ago", read: false },
    { id: "2", title: "Safe place reached", detail: "Mia arrived at Greenfield School.", time: "8:11 AM", read: false },
    { id: "3", title: "New app request", detail: "Mia requested access to Pinterest.", time: "Yesterday", read: false },
    { id: "4", title: "Browser protection", detail: "A restricted page was blocked safely.", time: "Yesterday", read: true },
  ],
  remote: {
    status: "idle",
    tool: "Screen Mirror",
    consentRequired: false,
    audioActive: false,
  },
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
app.post("/make-server-2d83519f/auth/signup", async (c) => {
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

    const userKey = `user:${email.toLowerCase()}`;
    const existing = await kv.get(userKey);
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
app.post("/make-server-2d83519f/auth/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp } = body || {};
    if (!email || !otp) {
      return c.json({ error: "Email and 6-digit OTP code are required" }, 400);
    }

    const allowed = await checkRateLimit(`verify-otp:${email.toLowerCase()}`, 10, 5 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many verification attempts. Please wait 5 minutes before trying again." }, 429);
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

    const userKey = `user:${email.toLowerCase()}`;
    const user = { name: pending.name, email: pending.email, emailVerified: true, createdAt: new Date().toISOString() };
    await kv.set(userKey, { ...user, password: pending.password });
    await kv.set(pendingKey, null);

    const token = await signJwt({ email: user.email, name: user.name });

    return c.json({ success: true, user, token, message: "Email successfully verified! Welcome to StayKids." });
  } catch (_e) {
    return c.json({ error: "OTP verification failed" }, 500);
  }
});

// Forgot Password - Send Reset OTP Endpoint
app.post("/make-server-2d83519f/auth/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body || {};
    if (!email) return c.json({ error: "Email is required" }, 400);

    const allowed = await checkRateLimit(`forgot-pwd:${email.toLowerCase()}`, 3, 10 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many password reset requests. Please wait 10 minutes before requesting again." }, 429);
    }

    const userKey = `user:${email.toLowerCase()}`;
    const user = await kv.get(userKey);
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
app.post("/make-server-2d83519f/auth/reset-password", async (c) => {
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

    const userKey = `user:${email.toLowerCase()}`;
    const user = await kv.get(userKey);
    if (!user) return c.json({ error: "Account not found." }, 404);

    // Hash New Password with PBKDF2
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await kv.set(userKey, user);
    await kv.set(resetKey, null); // Clear reset record

    // Issue New Signed JWT Token
    const token = await signJwt({ email: user.email, name: user.name });

    return c.json({
      success: true,
      user: { name: user.name, email: user.email },
      token,
      message: "Password reset successful! You are now logged in.",
    });
  } catch (_e) {
    return c.json({ error: "Failed to reset password" }, 500);
  }
});

// Auth Resend OTP Endpoint
app.post("/make-server-2d83519f/auth/resend-otp", async (c) => {
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
app.post("/make-server-2d83519f/auth/login", async (c) => {
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

    const userKey = `user:${email.toLowerCase()}`;
    const user = await kv.get(userKey);
    if (!user) {
      return c.json({ error: "Invalid email address or password." }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return c.json({ error: "Invalid email address or password." }, 401);
    }

    const token = await signJwt({ email: user.email, name: user.name });

    return c.json({ success: true, user: { name: user.name, email: user.email }, token });
  } catch (_e) {
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// Pairing Code Generation Endpoint
app.post("/make-server-2d83519f/pairing/generate", async (c) => {
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
app.post("/make-server-2d83519f/pairing/claim", async (c) => {
  try {
    const body = await c.req.json();
    const { pin, deviceName } = body || {};
    if (!pin || pin.length !== 6) {
      return c.json({ error: "Please enter a valid 6-digit PIN code." }, 400);
    }

    const allowed = await checkRateLimit(`pairing-claim:${pin}`, 5, 5 * 60000);
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
app.get("/make-server-2d83519f/health", (c) => {
  return c.json({ status: "ok" });
});

// GET state endpoint (Accepts Parent Token & Device Token)
app.get("/make-server-2d83519f/state", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }
    const parentStateKey = `state:${authCtx.email.toLowerCase()}`;
    const state = await kv.get(parentStateKey);
    return c.json(state || defaultState);
  } catch (_e) {
    return c.json(defaultState);
  }
});

// POST action endpoint for real-time state mutation & persistence (with Per-Child & Token Scoping)
app.post("/make-server-2d83519f/action", async (c) => {
  try {
    const authCtx = await getAuthContext(c);
    if (!authCtx) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }

    const action = await c.req.json();
    const parentStateKey = `state:${authCtx.email.toLowerCase()}`;

    // Restrict parent-only management actions for device-scoped tokens
    if (authCtx.isDevice) {
      const parentOnlyActions = ["add-child", "upgrade-premium", "change-password", "generate-pin", "select-child"];
      if (parentOnlyActions.includes(action.type)) {
        return c.json({ error: "Forbidden. Action not permitted for device token." }, 403);
      }
    }

    let state = (await kv.get(parentStateKey)) || JSON.parse(JSON.stringify(defaultState));

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
          title: "▣ Live Screen Mirror Requested",
          detail: `MediaProjection WebRTC stream session initiated for ${state.child.name}.`,
          time: "Just now",
          read: false,
        });
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
        title: "🆘 EMERGENCY SOS SIGNAL RECEIVED",
        detail: `${state.child.name} triggered Emergency SOS button! Immediate attention required.`,
        time: "JUST NOW",
        read: false,
      });
    } else if (action.type === "log-call-sms" && typeof action.detail === "string") {
      state.alerts.unshift({
        id: String(Date.now()),
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
      if (!nextActive) {
        state.remote.liveAudioChunk = null;
      }
    }

    await kv.set(parentStateKey, state);
    return c.json(state);
  } catch (_e) {
    return c.json(defaultState);
  }
});

Deno.serve(app.fetch);