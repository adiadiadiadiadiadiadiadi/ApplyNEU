import express, { type Response } from 'express';
import type {
  PostUserRequest,
  PutUserRequest,
  UserIdRequest,
  UpdatePreferencesRequest,
  UpdateInterestsRequest,
  UpdateJobTypesRequest,
  GetJobTypesRequest,
  GetSearchTermsRequest,
  GetUserInterestsRequest,
} from '../types/users.ts';
import { validateAddUser, validateUserIdParam, validateUpdateUser, validateUpdateInterests, validateUpdateJobTypes } from './middleware/validators/user.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import {
  addUser,
  getJobTypes,
  getSearchTerms,
  getUser,
  getUserInterests,
  getUserPreferences,
  updateJobType,
  updateUser,
  updateUserInterests,
  updateUserPreferences,
} from '../services/user/user.service.ts';
import { getUserApplicationStats } from '../services/application.service.ts';
import type { ApplicationStatsRequest } from '../types/applications.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const userController = () => {
  const router = express.Router();

  /** POST /new — register a new user account. */
  const addUserRoute = async (req: PostUserRequest, res: Response) => {
    const { user_id, first_name, last_name, email, grad_year } = req.body;
    const user = await addUser(user_id, first_name, last_name, email, grad_year);
    res.status(200).json(user);
  };

  /** GET /:user_id — fetch a user's profile. */
  const getUserRoute = async (req: UserIdRequest, res: Response) => {
    const { user_id } = req.params;
    const user = await getUser(user_id);
    res.status(200).json(user);
  };

  /** PUT /:user_id — update a user's basic profile fields. */
  const updateUserRoute = async (req: PutUserRequest, res: Response) => {
    const { user_id } = req.params;
    const { first_name, last_name, email, grad_year } = req.body;
    const user = await updateUser(user_id, first_name, last_name, email, grad_year);
    res.status(200).json(user);
  };

  /** GET /:user_id/preferences — return the user's job-matching preferences. */
  const getPreferencesRoute = async (req: UserIdRequest, res: Response) => {
    const { user_id } = req.params;
    const prefs = await getUserPreferences(user_id);
    res.status(200).json(prefs);
  };

  /** PUT /:user_id/preferences — update job-matching preference flags for the user. */
  const updatePreferencesRoute = async (req: UpdatePreferencesRequest, res: Response) => {
    const { user_id } = req.params;
    const { wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications } = req.body;
    const prefs = await updateUserPreferences(user_id, wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications);
    res.status(200).json(prefs);
  };

  /** GET /:user_id/interests — return the user's saved interest tags. */
  const getUserInterestsRoute = async (req: GetUserInterestsRequest, res: Response) => {
    const { user_id } = req.params;
    const result = await getUserInterests(user_id);
    res.status(200).json(result);
  };

  /** GET /:user_id/search-terms — return the AI-generated search terms derived from the user's resume. */
  const getSearchTermsRoute = async (req: GetSearchTermsRequest, res: Response) => {
    const { user_id } = req.params;
    const result = await getSearchTerms(user_id);
    res.status(200).json(result);
  };

  /** GET /:user_id/job-types — return the job types (co-op, full-time, etc.) the user is targeting. */
  const getJobTypesRoute = async (req: GetJobTypesRequest, res: Response) => {
    const { user_id } = req.params;
    const result = await getJobTypes(user_id);
    res.status(200).json(result);
  };

  /** PUT /:user_id/interests — replace the user's interest tags. */
  const updateUserInterestsRoute = async (req: UpdateInterestsRequest, res: Response) => {
    const { user_id } = req.params;
    const { interests } = req.body;
    const result = await updateUserInterests(user_id, interests);
    res.status(200).json(result);
  };

  /** PUT /:user_id/job-types — update the job types the user is targeting. */
  const updateJobTypeRoute = async (req: UpdateJobTypesRequest, res: Response) => {
    const { user_id } = req.params;
    const { job_types } = req.body;
    const result = await updateJobType(user_id, job_types);
    res.status(200).json(result);
  };

  /** GET /:user_id/application-stats — return aggregate application counts broken down by status. */
  const getApplicationStatsRoute = async (req: ApplicationStatsRequest, res: Response) => {
    const { user_id } = req.params;
    const stats = await getUserApplicationStats(user_id);
    res.status(200).json(stats);
  };

  router.post('/new', validateAddUser, asyncHandler(addUserRoute));
  router.get('/:user_id', validateUserIdParam, asyncHandler(getUserRoute));
  router.put('/:user_id', validateUpdateUser, requireUser, asyncHandler(updateUserRoute));
  router.get('/:user_id/preferences', validateUserIdParam, requireUser, asyncHandler(getPreferencesRoute));
  router.put('/:user_id/preferences', validateUserIdParam, requireUser, asyncHandler(updatePreferencesRoute));
  router.get('/:user_id/interests', validateUserIdParam, requireUser, asyncHandler(getUserInterestsRoute));
  router.put('/:user_id/interests', validateUpdateInterests, requireUser, asyncHandler(updateUserInterestsRoute));
  router.put('/:user_id/job-types', validateUpdateJobTypes, requireUser, asyncHandler(updateJobTypeRoute));
  router.get('/:user_id/job-types', validateUserIdParam, requireUser, asyncHandler(getJobTypesRoute));
  router.get('/:user_id/search-terms', validateUserIdParam, requireUser, asyncHandler(getSearchTermsRoute));
  router.get('/:user_id/application-stats', validateUserIdParam, requireUser, asyncHandler(getApplicationStatsRoute));

  return router;
};

export default userController;
