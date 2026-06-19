import express, { type Response } from 'express';
import type {
  PostUserRequest,
  PutUserRequest,
  UserIdRequest,
} from '../types/users.ts';
import { validateAddUser, validateUserIdParam, validateUpdateUser } from './middleware/validators/user.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import { addUser, getUser, updateUser } from '../services/user/user.service.ts';
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

  /** GET /:user_id/application-stats — return aggregate application counts broken down by status. */
  const getApplicationStatsRoute = async (req: ApplicationStatsRequest, res: Response) => {
    const { user_id } = req.params;
    const stats = await getUserApplicationStats(user_id);
    res.status(200).json(stats);
  };

  router.post('/new', validateAddUser, asyncHandler(addUserRoute));
  router.get('/:user_id', validateUserIdParam, asyncHandler(getUserRoute));
  router.put('/:user_id', validateUpdateUser, requireUser, asyncHandler(updateUserRoute));
  router.get('/:user_id/application-stats', validateUserIdParam, requireUser, asyncHandler(getApplicationStatsRoute));

  return router;
};

export default userController;
