import express, { type Request, type Response } from 'express';
import type {
  UpdatePreferencesRequest,
  UpdateJobTypesRequest,
  UpdateInterestsRequest,
} from '../types/users.ts';
import {
  getUserPreferences,
  updateUserPreferences,
  getJobTypes,
  updateJobType,
  getInterests,
  updateInterests,
} from '../services/preference.service.ts';
import { validateUpdateJobTypes, validateUpdateInterests } from './middleware/validators/preference.validate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

export const mePreferenceController = () => {
  const router = express.Router();

  /** GET /me/preferences — return the caller's job-matching preferences. */
  const getPreferencesRoute = async (req: Request, res: Response) => {
    const prefs = await getUserPreferences(req.auth!.userId);
    res.status(200).json(prefs);
  };

  /** PUT /me/preferences — update job-matching preference flags for the caller. */
  const updatePreferencesRoute = async (req: UpdatePreferencesRequest, res: Response) => {
    const { wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications } = req.body;
    const prefs = await updateUserPreferences(req.auth!.userId, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications);
    res.status(200).json(prefs);
  };

  /** GET /me/preferences/job-types — return the job types the caller is targeting. */
  const getJobTypesRoute = async (req: Request, res: Response) => {
    const result = await getJobTypes(req.auth!.userId);
    res.status(200).json(result);
  };

  /** PUT /me/preferences/job-types — update the job types the caller is targeting. */
  const updateJobTypeRoute = async (req: UpdateJobTypesRequest, res: Response) => {
    const { job_types } = req.body;
    const result = await updateJobType(req.auth!.userId, job_types);
    res.status(200).json(result);
  };

  /** GET /me/preferences/interests — return the caller's selected interests. */
  const getInterestsRoute = async (req: Request, res: Response) => {
    const result = await getInterests(req.auth!.userId);
    res.status(200).json(result);
  };

  /** PUT /me/preferences/interests — replace the caller's interests with values from the preset list. */
  const updateInterestsRoute = async (req: UpdateInterestsRequest, res: Response) => {
    const result = await updateInterests(req.auth!.userId, req.body.interests);
    res.status(200).json(result);
  };

  router.get('/', asyncHandler(getPreferencesRoute));
  router.put('/', asyncHandler(updatePreferencesRoute));
  router.get('/job-types', asyncHandler(getJobTypesRoute));
  router.put('/job-types', validateUpdateJobTypes, asyncHandler(updateJobTypeRoute));
  router.get('/interests', asyncHandler(getInterestsRoute));
  router.put('/interests', validateUpdateInterests, asyncHandler(updateInterestsRoute));

  return router;
};
