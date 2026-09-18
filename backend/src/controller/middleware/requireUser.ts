import type { Request, Response, NextFunction } from 'express';
import { authenticate } from './authenticate.ts';

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const user_id = req.params.user_id;
  if (!user_id) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  await authenticate(req, res, () => {
    if (req.auth?.userId !== user_id) {
      res.status(403).json({ message: 'Forbidden.' });
      return;
    }
    next();
  });
};
