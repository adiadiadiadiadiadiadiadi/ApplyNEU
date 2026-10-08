import express, { type Request, type Response } from 'express';
import { hostname } from 'os';
import { pool } from './db/index.ts';
import { redis } from './db/redis.ts';

const CHECK_TIMEOUT_MS = 2000;

let draining = false;

/** Called once shutdown starts, so the load balancer stops routing to this instance. */
export const startDraining = () => {
  draining = true;
};

const withTimeout = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS).unref()),
  ]);

const check = async (probe: () => Promise<unknown>) => {
  try {
    await withTimeout(probe());
    return 'ok';
  } catch {
    return 'down';
  }
};

/**
 * GET /healthz answers whether the process is alive and never touches a dependency, so a
 * slow database can't get a healthy container restarted. GET /readyz answers whether this
 * instance should receive traffic: it fails while draining or when Postgres is unreachable.
 * Redis is reported but doesn't fail readiness, since every Redis use falls back without it.
 */
export const healthRouter = (): express.Router => {
  const router = express.Router();

  router.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', instance: hostname() });
  });

  router.get('/readyz', async (_req: Request, res: Response) => {
    if (draining) {
      res.status(503).json({ status: 'draining', instance: hostname() });
      return;
    }
    const [postgres, redisStatus] = await Promise.all([
      check(() => pool.query('SELECT 1')),
      check(() => redis.ping()),
    ]);
    res.status(postgres === 'ok' ? 200 : 503).json({ postgres, redis: redisStatus, instance: hostname() });
  });

  return router;
};
