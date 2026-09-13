import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Verifies the Supabase-issued access token attached to the request and, if valid,
// attaches the authenticated caller's id as req.auth.userId. Local signature
// verification (no call out to Supabase) keeps this stateless so any replica can
// authenticate a request on its own. Does not check ownership of any resource in
// the URL — callers that need that should layer it on top (see requireUser.ts for
// the :user_id case, or check ownership against a DB row for other id shapes).
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const jwtKey = process.env.SUPABASE_JWT_KEY;
  if (!jwtKey) {
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
    const decoded = jwt.verify(token, jwtKey, { algorithms: ['HS256'] });
    const callerId = typeof decoded === 'object' ? decoded.sub : undefined;
    if (!callerId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }
    req.auth = { userId: callerId };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized.' });
  }
};
