import express, { type Request, type Response } from 'express';
import { INTERESTS } from '../constants/interests.ts';
import { authenticate } from './middleware/authenticate.ts';

export const interestController = (): express.Router => {
  const router = express.Router();

  /** GET /interests — return the preset list of interests a user can pick from. */
  const getInterestsRoute = (_req: Request, res: Response) => {
    res.status(200).json(INTERESTS);
  };

  router.get('/', authenticate, getInterestsRoute);

  return router;
};
