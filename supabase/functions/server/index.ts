import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { authRoutes, userRoutes } from './auth_routes.ts';
import { pairingRoutes } from './pairing_routes.ts';
import { actionRoutes } from './action_routes.ts';
import { cleanupRoutes } from './cleanup_routes.ts';

import { verifyHmacSignature } from './security.ts';

const app = new Hono();
app.use('*', logger(console.log));
app.use('/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info', 'x-supabase-auth', 'X-Cleanup-Secret', 'X-Request-Timestamp', 'X-Request-Signature'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// HMAC Signature Verification Middleware
app.use(async (c, next) => {
  // Skip CORS preflight, health checks, or specific optional routes if needed
  if (c.req.method === 'OPTIONS' || c.req.path === '/server/health') {
    return await next();
  }
  
  const rawBodyText = (c.req.method === 'POST' || c.req.method === 'PUT') ? await c.req.raw.clone().text() : "";
  const isValid = await verifyHmacSignature(c.req.raw, rawBodyText, c.req.path);
  
  if (!isValid) {
    return c.json({ error: "Forbidden: Invalid or missing request signature" }, 403);
  }
  
  await next();
});

app.route('/server/auth', authRoutes);
app.route('/server/user', userRoutes);
app.route('/server/pairing', pairingRoutes);
app.route('/server', actionRoutes);
app.route('', cleanupRoutes);

// Health check
app.get('/server/health', (c) => c.json({ status: 'ok' }));

Deno.serve(app.fetch);
