import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

// Verifies the Supabase-issued access token attached to the request and, if valid,
// attaches the authenticated caller's id as req.auth.userId. Verifies against the
// Supabase project's public JWKS (asymmetric signing keys) rather than a shared
// secret, so this keeps working across Supabase's own key rotations without
// needing a matching secret copied into this service's config. Does not check
// ownership of any resource in the URL — callers that need that should layer it
// on top (see requireUser.ts for the :user_id case, or check ownership against a
// DB row for other id shapes).
const supabaseUrl = process.env.NODE_ENV === 'production'
  ? process.env.PROD_SUPABASE_URL
  : process.env.DEV_SUPABASE_URL;

// createRemoteJWKSet caches the fetched key set (and re-fetches on unknown kid),
// so one instance per process is enough.
const jwks = supabaseUrl ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)) : null;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  if (!jwks) {
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
    const { payload } = await jwtVerify(token, jwks, { algorithms: ['ES256'] });
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
