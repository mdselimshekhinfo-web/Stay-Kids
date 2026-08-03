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
  origin: (origin) => {
    const allowedOrigins = ['capacitor://localhost', 'http://localhost:8443', 'http://localhost:5173'];
    const reqOrigin = origin || '';
    return allowedOrigins.includes(reqOrigin) ? reqOrigin : '';
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}));

app.route('/server/auth', authRoutes);
app.route('/server/user', userRoutes);
app.route('/server/pairing', pairingRoutes);
app.route('/server', actionRoutes);
app.route('', cleanupRoutes);

// Health check
app.get('/server/health', (c) => c.json({ status: 'ok' }));

Deno.serve(app.fetch);
