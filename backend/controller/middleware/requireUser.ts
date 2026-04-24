import type { Request, Response, NextFunction } from 'express';
import { getUser } from '../../services/user.service.ts';

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const user_id = req.params.user_id;
  const user = user_id && await getUser(user_id);
  if (!user || 'error' in user) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }
  next();
};
