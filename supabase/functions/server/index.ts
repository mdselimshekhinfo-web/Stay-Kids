import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { authRoutes, userRoutes } from './auth_routes.ts';
import { pairingRoutes } from './pairing_routes.ts';
import { actionRoutes } from './action_routes.ts';
import { cleanupRoutes } from './cleanup_routes.ts';

const app = new Hono();
app.use('*', logger(console.log));
app.use('/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-client-info', 'x-supabase-auth', 'X-Cleanup-Secret'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

app.route('/server/auth', authRoutes);
app.route('/server/user', userRoutes);
app.route('/server/pairing', pairingRoutes);
app.route('/server', actionRoutes);
app.route('', cleanupRoutes);

// Health check
app.get('/server/health', (c) => c.json({ status: 'ok' }));

Deno.serve(app.fetch);
