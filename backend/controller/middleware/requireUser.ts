import type { Request, Response, NextFunction } from 'express';
import { getUser } from '../../services/user/user.service.ts';

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const user_id = req.params.user_id;
  if (!user_id) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }
  try {
    await getUser(user_id);
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized.' });
  }
};
