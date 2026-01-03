import express, { type Request, type Response } from 'express';
import type { PostUserRequest } from '../types/users.ts';
import { addUser, getUserInterests, updateSearchTerms, updateUserInterests } from '../services/user.service.ts';

/**
 * This controller handles user-related routes.
 * 
 * @returns {express.Router} The router object containing the words routes.
 */
const userController = () => {
  const router = express.Router();

  const addUserRoute = async (req: PostUserRequest, res: Response) => {
    const { user_id, first_name, last_name, email, grad_year } = req.body;

    if (!user_id || !first_name || !last_name || !email || !grad_year) {
      res.status(404).json({
        "message": "Required arguments not found to post user."
      });
      return;
    }

    try {
      const user = await addUser(user_id, first_name, last_name, email, grad_year);

      if ('error' in user) {
        res.status(400).json({
          "message": "Unable to post user."
        });
        return;
      }
      res.status(200).json(user);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to post user."
      });
    }
  };

  const getUserInterestsRoute = async (req: Request, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to get interests."
      });
      return;
    }

    try {
      const result = await getUserInterests(user_id);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to get interests."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to get interests."
      });
    }
  };

  const updateUserInterestsRoute = async (req: Request, res: Response) => {
    const { user_id } = req.params;
    const { interests } = req.body;

    if (!user_id || !interests) {
      res.status(404).json({
        "message": "Required arguments not found to update interests."
      });
      return;
    }

    try {
      const result = await updateUserInterests(user_id, interests);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to update interests."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to update interests."
      });
    }
  };

  const updateSearchTermsRoute = async (req: Request, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to update search terms."
      });
      return;
    }

    try {
      const result = await updateSearchTerms(user_id);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to update search terms."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to update search terms."
      });
    }
  };

  router.post('/new', addUserRoute);
  router.get('/:user_id/interests', getUserInterestsRoute);
  router.put('/:user_id/interests', updateUserInterestsRoute);
  router.put('/:user_id/search-terms', updateSearchTermsRoute);
  return router;
};

export default userController;
