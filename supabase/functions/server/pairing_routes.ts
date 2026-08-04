import { Hono } from 'npm:hono';
import { getAuthenticatedUser } from './db.ts';
import { signDeviceJwt, checkRateLimit } from './security.ts';
import * as kv from './kv_store.tsx';

export const pairingRoutes = new Hono();

// Pairing Code Generation Endpoint
pairingRoutes.post("/generate", async (c) => {
  try {
    const authUser = await getAuthenticatedUser(c);
    if (!authUser) {
      return c.json({ error: "Unauthorized. Valid JWT Authorization token is required." }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const targetChildId = body?.childId || "child-1";

    const pin = (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return String(100000 + (a[0] % 900000)); })();
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

// Device Claim Endpoint (3.2 Hardcoded Email Removal)
pairingRoutes.post("/claim", async (c) => {
  try {
    const body = await c.req.json();
    const { pin, deviceName } = body || {};
    if (!pin || pin.length !== 6) {
      return c.json({ error: "Please enter a valid 6-digit PIN code." }, 400);
    }

    const ip = c.req.header("x-forwarded-for") || "unknown";
    const ipAllowed = await checkRateLimit(`pairing-claim-ip:${ip}`, 10, 5 * 60000);
    const pinAllowed = await checkRateLimit(`pairing-claim-pin:${pin}`, 3, 5 * 60000);
    
    if (!ipAllowed || !pinAllowed) {
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

    const parentEmail = pairing.parentId || pairing.parentEmail;
    if (!parentEmail) {
      return c.json({ error: "Invalid pairing record: missing parent information." }, 400);
    }

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
