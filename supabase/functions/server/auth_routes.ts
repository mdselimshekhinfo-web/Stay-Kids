import { Hono } from 'npm:hono';
import { getAuthenticatedUser, getProfile, isValidEmail, getStateFromDB } from './db.ts';
import { hashPassword, verifyPassword, signJwt, checkRateLimit } from './security.ts';
import * as kv from './kv_store.tsx';
import { createClient } from 'npm:@supabase/supabase-js';

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export const authRoutes = new Hono();
export const userRoutes = new Hono();

async function sendRealEmailOtp(email: string, otp: string, type: "signup" | "reset" = "signup") {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY") || "";

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

  if (brevoApiKey) {
    try {
      const senderEmail = Deno.env.get("SENDER_EMAIL") || "noreply@staykids.app";
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "StayKids Security", email: senderEmail },
          to: [{ email }],
          subject,
          htmlContent,
        }),
      });
      if (res.ok) return true;
      const errJson = await res.json().catch(() => ({}));
      console.error(`Brevo API Email Delivery Failure HTTP ${res.status}:`, JSON.stringify(errJson));
    } catch (e) {
      console.error("Brevo fetch error:", e);
    }
  } else {
    console.error("BREVO_API_KEY is not configured in environment variables.");
  }

  console.error(`[STAYKIDS OTP DELIVERY FAILED] Could not send OTP email to ${email} — Brevo unavailable.`);
  return false;
}

function isStrongPassword(password: string): boolean {
  if (!password || typeof password !== "string" || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

// Auth Sign Up Endpoint
authRoutes.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, password } = body || {};
    if (!email || !password || !isValidEmail(email)) {
      return c.json({ error: "A valid email address and password are required." }, 400);
    }
    if (!isStrongPassword(password)) {
      return c.json({ error: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character." }, 400);
    }

    const allowed = await checkRateLimit(email, 5, 60000);
    if (!allowed) {
      return c.json({ error: "Too many registration attempts. Please try again in 1 minute." }, 429);
    }

    try {
      const { data: existing } = await supabase.from('profiles').select('email').eq('email', email.toLowerCase()).maybeSingle();
      if (existing) {
        return c.json({ error: "Account already exists with this email address." }, 400);
      }
    } catch (dbErr) {
      console.warn("Profiles check warning:", dbErr);
    }

    const otp = (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + (a[0] % 900000)); })();
    const hashedPassword = await hashPassword(password);
    
    const pendingKey = `pending:${email.toLowerCase()}`;
    await kv.set(pendingKey, {
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await sendRealEmailOtp(email.toLowerCase(), otp, "signup").catch((e) => console.warn("Email delivery warning:", e));

    return c.json({
      success: true,
      requiresOtp: true,
      email: email.toLowerCase(),
      message: `A 6-digit verification OTP code has been sent to ${email}. Check your inbox or spam folder.`,
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    return c.json({ error: err?.message || "Failed to initiate registration" }, 500);
  }
});

// Auth Verify Email OTP Endpoint
authRoutes.post("/verify-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp } = body || {};
    if (!email || !otp || !isValidEmail(email)) {
      return c.json({ error: "A valid email address and 6-digit OTP code are required." }, 400);
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
      return c.json({ error: "Failed to create account", details: insertError }, 500);
    }

    await kv.set(pendingKey, null);

    const token = await signJwt({ email: user.email, name: user.full_name });

    return c.json({ success: true, user, token, message: "Email successfully verified! Welcome to StayKids." });
  } catch (_e) {
    return c.json({ error: "OTP verification failed" }, 500);
  }
});

// Forgot Password - Send Reset OTP Endpoint (4.2 Email Enumeration Guard)
authRoutes.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body || {};
    if (!email || !isValidEmail(email)) return c.json({ error: "A valid email address is required." }, 400);

    const allowed = await checkRateLimit(`forgot-pwd:${email.toLowerCase()}`, 3, 10 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many password reset requests. Please wait 10 minutes before requesting again." }, 429);
    }

    const { data: user } = await supabase.from('profiles').select('email').eq('email', email.toLowerCase()).maybeSingle();
    
    // Generic response regardless of email existence to prevent email enumeration attacks
    if (user) {
      const otp = (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + (a[0] % 900000)); })();
      const resetKey = `reset:${email.toLowerCase()}`;
      await kv.set(resetKey, {
        email: email.toLowerCase(),
        otp,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      await sendRealEmailOtp(email.toLowerCase(), otp, "reset");
    }

    return c.json({
      success: true,
      email: email.toLowerCase(),
      message: `If this email address is registered, a 6-digit password reset OTP code has been sent. Check your inbox or spam folder.`,
    });
  } catch (_e) {
    return c.json({ error: "Failed to process forgot password request" }, 500);
  }
});

// Confirm Password Reset with OTP Endpoint
authRoutes.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email, otp, newPassword } = body || {};
    if (!email || !otp || !newPassword || !isValidEmail(email)) {
      return c.json({ error: "A valid email address, OTP code, and new password are required." }, 400);
    }
    if (!isStrongPassword(newPassword)) {
      return c.json({ error: "New password must be at least 10 characters long and contain at least one uppercase letter, one lowercase letter, and one number." }, 400);
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

    const { data: user } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
    if (!user) return c.json({ error: "Account not found." }, 404);

    const hashedPassword = await hashPassword(newPassword);
    await supabase.from('profiles').update({ password_hash: hashedPassword }).eq('email', email.toLowerCase());
    await kv.set(resetKey, null);

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

// B.2 In-App Change Password Endpoint
authRoutes.post("/change-password", async (c) => {
  try {
    const authCtx = await getAuthenticatedUser(c);
    if (!authCtx) return c.json({ error: "Unauthorized" }, 401);

    const allowed = await checkRateLimit(`change-pwd:${authCtx.email.toLowerCase()}`, 5, 15 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many password change attempts. Please try again in 15 minutes." }, 429);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body || {};
    if (!currentPassword || !newPassword) {
      return c.json({ error: "Current password and new password are required." }, 400);
    }
    if (!isStrongPassword(newPassword)) {
      return c.json({ error: "New password must be at least 10 characters long and contain at least one uppercase letter, one lowercase letter, and one number." }, 400);
    }

    const { data: user } = await supabase.from('profiles').select('*').eq('email', authCtx.email).maybeSingle();
    if (!user || !user.password_hash) {
      return c.json({ error: "Account profile not found." }, 404);
    }

    const isMatch = await verifyPassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return c.json({ error: "Current password is incorrect." }, 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    await supabase.from('profiles').update({ password_hash: hashedPassword }).eq('email', authCtx.email);

    return c.json({ success: true, message: "Password changed successfully." });
  } catch (_e) {
    return c.json({ error: "Failed to change password." }, 500);
  }
});

// B.4 Data Export Endpoint
userRoutes.get("/export-data", async (c) => {
  try {
    const authCtx = await getAuthenticatedUser(c);
    if (!authCtx) return c.json({ error: "Unauthorized" }, 401);

    const state = await getStateFromDB(authCtx.email);
    const { data: profile } = await supabase.from('profiles').select('id, full_name, email, created_at').eq('email', authCtx.email).maybeSingle();

    return c.json({
      exportDate: new Date().toISOString(),
      parentProfile: profile,
      appState: state,
    });
  } catch (_e) {
    return c.json({ error: "Failed to export user data." }, 500);
  }
});

// B.4 Account Deletion Endpoint
userRoutes.post("/delete-account", async (c) => {
  try {
    const authCtx = await getAuthenticatedUser(c);
    if (!authCtx) return c.json({ error: "Unauthorized" }, 401);

    const allowed = await checkRateLimit(`delete-acc:${authCtx.email.toLowerCase()}`, 3, 60 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many account deletion attempts. Please try again in an hour." }, 429);
    }

    const { data: profile } = await supabase.from('profiles').select('id').eq('email', authCtx.email).maybeSingle();
    if (profile) {
      const { data: children } = await supabase.from('children').select('id').eq('parent_id', profile.id);
      const childIds = (children || []).map((ch: any) => ch.id);
      if (childIds.length > 0) {
        await supabase.from('device_controls').delete().in('child_id', childIds);
        await supabase.from('app_usage').delete().in('child_id', childIds);
        await supabase.from('alerts').delete().in('child_id', childIds);
        await supabase.from('blocked_apps').delete().in('child_id', childIds);
        await supabase.from('daily_usage_logs').delete().in('child_id', childIds);
        await supabase.from('children').delete().eq('parent_id', profile.id);
      }
      await supabase.from('profiles').delete().eq('id', profile.id);
    }

    const parentStateKey = `state:${authCtx.email}`;
    await kv.set(parentStateKey, null);

    return c.json({ success: true, message: "Account and associated data deleted permanently." });
  } catch (_e) {
    return c.json({ error: "Failed to delete account." }, 500);
  }
});

// Priority 5: Revoke All Parent Sessions Endpoint
authRoutes.post("/revoke-all-sessions", async (c) => {
  try {
    const authCtx = await getAuthenticatedUser(c);
    if (!authCtx) return c.json({ error: "Unauthorized" }, 401);

    const nowIso = new Date().toISOString();
    await supabase.from('profiles').update({ token_valid_after: nowIso }).eq('email', authCtx.email);

    return c.json({ success: true, message: "All previous sessions have been revoked. Please log in again if required." });
  } catch (_e) {
    return c.json({ error: "Failed to revoke sessions." }, 500);
  }
});

// Auth Resend OTP Endpoint (1.1 OTP Leak Fix)
authRoutes.post("/resend-otp", async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body || {};
    if (!email || !isValidEmail(email)) return c.json({ error: "A valid email address is required." }, 400);

    const allowed = await checkRateLimit(`resend-otp:${email.toLowerCase()}`, 3, 10 * 60000);
    if (!allowed) {
      return c.json({ error: "Too many OTP resend requests. Please wait 10 minutes before requesting again." }, 429);
    }

    const pendingKey = `pending:${email.toLowerCase()}`;
    const pending = await kv.get(pendingKey);
    if (!pending) {
      return c.json({ error: "No pending registration found. Please sign up." }, 400);
    }

    const newOtp = (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + (a[0] % 900000)); })();
    pending.otp = newOtp;
    pending.expiresAt = Date.now() + 5 * 60 * 1000;
    await kv.set(pendingKey, pending);

    const emailSent = await sendRealEmailOtp(email.toLowerCase(), newOtp, "signup");

    if (!emailSent) {
      return c.json({ error: "Failed to send verification email. Please try again shortly or contact support." }, 500);
    }

    return c.json({
      success: true,
      message: `New 6-digit OTP code sent to ${email}`,
    });
  } catch (_e) {
    return c.json({ error: "Failed to resend OTP" }, 500);
  }
});

// Auth Login Endpoint
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body || {};
    if (!email || !password || !isValidEmail(email)) {
      return c.json({ error: "A valid email address and password are required." }, 400);
    }

    const allowed = await checkRateLimit(email, 5, 60000);
    if (!allowed) {
      return c.json({ error: "Too many login attempts. Please wait 1 minute before trying again." }, 429);
    }

    const { data: user } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle();
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
