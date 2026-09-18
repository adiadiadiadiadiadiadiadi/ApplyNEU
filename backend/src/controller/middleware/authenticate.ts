import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// createRemoteJWKSet caches the fetched key set (and re-fetches on unknown kid), so
// one instance per process is enough. Built on first use rather than at import time so
// the environment doesn't have to be loaded before this module is pulled in.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

const getJwks = () => {
  if (jwks) return jwks;
  const supabaseUrl = process.env.NODE_ENV === 'production'
    ? process.env.PROD_SUPABASE_URL
    : process.env.DEV_SUPABASE_URL;
  if (!supabaseUrl) return null;
  jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
  return jwks;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const keys = getJwks();
  if (!keys) {
    res.status(500).json({ message: 'Server misconfigured.' });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, keys, { algorithms: ['ES256'] });
    const callerId = typeof payload.sub === 'string' ? payload.sub : undefined;
    if (!callerId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }
    req.auth = { userId: callerId };
    next();
  } catch (err) {
    console.log('[authenticate] jwt verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ message: 'Unauthorized.' });
  }
};
