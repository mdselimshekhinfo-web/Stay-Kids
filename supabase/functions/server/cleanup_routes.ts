import { Hono } from 'npm:hono';
import { getAuthenticatedUser } from './db.ts';
import * as kv from './kv_store.tsx';

export const cleanupRoutes = new Hono();

// 3. KV Store Cleanup Job Endpoint
cleanupRoutes.all("/cleanup", async (c) => {
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

    // 5. Cleanup expired ephemeral streaming keys
    const lives = await kv.getByPrefixEntries("live:");
    for (const item of lives) {
      if (item.value && item.value.timestamp && now - item.value.timestamp > 60000) {
        keysToDelete.push(item.key);
      }
    }

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
