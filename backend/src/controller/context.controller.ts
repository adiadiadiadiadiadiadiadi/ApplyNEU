import express, { type Request, type Response } from 'express';
import { getCandidateContext } from '../services/candidateContext/candidateContext.service.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

export const meContextController = (): express.Router => {
  const router = express.Router();

  /** GET /me/context — return the caller's assembled resume, preferences and profile. */
  const getContextRoute = async (req: Request, res: Response) => {
    const context = await getCandidateContext(req.auth!.userId);
    res.status(200).json(context);
  };

  router.get('/', asyncHandler(getContextRoute));

  return router;
};
