import { Router } from 'express';
import { supabaseConfigured } from '../lib/supabase.js';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      // Auth visibility — lets a deployer confirm whether real Supabase
      // auth is live from a single curl (no logs digging). provider is
      // 'supabase' | 'dev' | 'none'.
      auth: {
        provider: supabaseConfigured() ? 'supabase' : config.devAuth ? 'dev' : 'none',
        supabaseConfigured: supabaseConfigured(),
      },
    },
  });
});
