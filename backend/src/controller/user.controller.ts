import express, { type Request, type Response } from 'express';
import type {
  PostUserRequest,
  PutUserRequest,
} from '../types/users.ts';
import { validateAddUser, validateUpdateUser } from './middleware/validators/user.validate.ts';
import { addUser, getUser, updateUser } from '../services/user/user.service.ts';
import { getUserApplicationStats } from '../services/application.service.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const userController = () => {
  const router = express.Router();

  /** POST /new — register a new user account. */
  const addUserRoute = async (req: PostUserRequest, res: Response) => {
    const { user_id, first_name, last_name, grad_year } = req.body;
    const user = await addUser(user_id, first_name, last_name, grad_year);
    res.status(200).json(user);
  };

  router.post('/new', validateAddUser, asyncHandler(addUserRoute));

  return router;
};

export const meUserController = () => {
  const router = express.Router();

  /** GET /me — fetch the caller's profile. */
  const getUserRoute = async (req: Request, res: Response) => {
    const user = await getUser(req.auth!.userId);
    res.status(200).json(user);
  };

  /** PUT /me — update the caller's basic profile fields. */
  const updateUserRoute = async (req: PutUserRequest, res: Response) => {
    const { first_name, last_name, grad_year } = req.body;
    const user = await updateUser(req.auth!.userId, first_name, last_name, grad_year);
    res.status(200).json(user);
  };

  /** GET /me/application-stats — return aggregate application counts broken down by status. */
  const getApplicationStatsRoute = async (req: Request, res: Response) => {
    const stats = await getUserApplicationStats(req.auth!.userId);
    res.status(200).json(stats);
  };

  router.get('/', asyncHandler(getUserRoute));
  router.put('/', validateUpdateUser, asyncHandler(updateUserRoute));
  router.get('/application-stats', asyncHandler(getApplicationStatsRoute));

  return router;
};

export default userController;
