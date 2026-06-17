import express, { type Response } from 'express';
import type {
  UserIdRequest,
  UpdatePreferencesRequest,
  UpdateJobTypesRequest,
  GetJobTypesRequest,
} from '../types/users.ts';
import {
  getUserPreferences,
  updateUserPreferences,
  getJobTypes,
  updateJobType,
} from '../services/preference.service.ts';
import {
  validateUserIdParam,
  validateUpdateJobTypes,
} from './middleware/validators/preference.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const preferenceController = () => {
  const router = express.Router();

  /** GET /:user_id — return the user's job-matching preferences. */
  const getPreferencesRoute = async (req: UserIdRequest, res: Response) => {
    const { user_id } = req.params;
    const prefs = await getUserPreferences(user_id);
    res.status(200).json(prefs);
  };

  /** PUT /:user_id — update job-matching preference flags for the user. */
  const updatePreferencesRoute = async (req: UpdatePreferencesRequest, res: Response) => {
    const { user_id } = req.params;
    const { wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications } = req.body;
    const prefs = await updateUserPreferences(user_id, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications);
    res.status(200).json(prefs);
  };

  /** GET /:user_id/job-types — return the job types the user is targeting. */
  const getJobTypesRoute = async (req: GetJobTypesRequest, res: Response) => {
    const { user_id } = req.params;
    const result = await getJobTypes(user_id);
    res.status(200).json(result);
  };

  /** PUT /:user_id/job-types — update the job types the user is targeting. */
  const updateJobTypeRoute = async (req: UpdateJobTypesRequest, res: Response) => {
    const { user_id } = req.params;
    const { job_types } = req.body;
    const result = await updateJobType(user_id, job_types);
    res.status(200).json(result);
  };

  router.get('/:user_id', validateUserIdParam, requireUser, asyncHandler(getPreferencesRoute));
  router.put('/:user_id', validateUserIdParam, requireUser, asyncHandler(updatePreferencesRoute));
  router.get('/:user_id/job-types', validateUserIdParam, requireUser, asyncHandler(getJobTypesRoute));
  router.put('/:user_id/job-types', validateUpdateJobTypes, requireUser, asyncHandler(updateJobTypeRoute));

  return router;
};

export default preferenceController;
