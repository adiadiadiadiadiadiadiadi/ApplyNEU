import express, { type Response } from 'express';
import type {
  PostUserRequest,
  PutUserRequest,
  UserIdRequest,
  UpdatePreferencesRequest,
  UpdateInterestsRequest,
  UpdateJobTypesRequest,
  UpdateSearchTermsRequest,
  CacheShortResumeRequest,
  GetJobTypesRequest,
  GetSearchTermsRequest,
  GetUserInterestsRequest,
} from '../types/users.ts';
import {
  addUser,
  cacheShortResume,
  getJobTypes,
  getSearchTerms,
  getUser,
  getUserInterests,
  getUserPreferences,
  updateJobType,
  updateSearchTerms,
  updateUser,
  updateUserInterests,
  updateUserPreferences,
} from '../services/user.service.ts';

/**
 * This controller handles user-related routes.
 * 
 * @returns {express.Router} The router object containing the words routes.
 */
const userController = () => {
  const router = express.Router();

  /**
   * Create a new user.
   * @param req body with user fields
   */
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

  /**
   * Fetch a user by id.
   * @param req params.user_id
   */
  const getUserRoute = async (req: UserIdRequest, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to get user."
      });
      return;
    }

    try {
      const user = await getUser(user_id);

      if ('error' in user) {
        res.status(404).json({
          "message": `User not found for id ${user_id}.`
        });
        return;
      }
      res.status(200).json(user);
    } catch (err: unknown) {
      res.status(400).json({
        "message": `Unable to get user ${user_id}.`
      });
    }
  };

  /**
   * Update core user fields.
   * @param req params.user_id, body user payload
   */
  const updateUserRoute = async (req: PutUserRequest, res: Response) => {
    const { user_id } = req.params;
    const { first_name, last_name, email, grad_year } = req.body;

    if (!user_id || !first_name || !last_name || !email || !grad_year) {
      res.status(404).json({
        "message": "Required arguments not found to update user."
      });
      return;
    }

    try {
      const user = await updateUser(user_id, first_name, last_name, email, grad_year);

      if ('error' in user) {
        res.status(400).json({
          "message": "Unable to update user."
        });
        return;
      }
      res.status(200).json(user);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to update user."
      });
    }
  };

  /**
   * Retrieve preference flags.
   * @param req params.user_id
   */
  const getPreferencesRoute = async (req: UserIdRequest, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to get preferences."
      });
      return;
    }

    try {
      const prefs = await getUserPreferences(user_id);

      if ('error' in prefs) {
        res.status(404).json({
          "message": "Preferences not found."
        });
        return;
      }
      res.status(200).json(prefs);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to get preferences."
      });
    }
  };

  /**
   * Update preference flags.
   * @param req params.user_id, body preference fields
   */
  const updatePreferencesRoute = async (req: UpdatePreferencesRequest, res: Response) => {
    const { user_id } = req.params;
    const { wait_for_approval, recent_jobs, job_match, unpaid_roles, email_notifications } = req.body;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to update preferences."
      });
      return;
    }

    try {
      const prefs = await updateUserPreferences(
        user_id,
        wait_for_approval,
        recent_jobs,
        job_match,
        unpaid_roles,
        email_notifications
      );

      if ('error' in prefs) {
        res.status(400).json({
          "message": "Unable to update preferences."
        });
        return;
      }
      res.status(200).json(prefs);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to update preferences."
      });
    }
  };

  /**
   * Get stored interests.
   * @param req params.user_id
   */
  const getUserInterestsRoute = async (req: GetUserInterestsRequest, res: Response) => {
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

  /**
   * Get stored search terms.
   * @param req params.user_id
   */
  const getSearchTermsRoute = async (req: GetSearchTermsRequest, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to get search terms."
      });
      return;
    }

    try {
      const result = await getSearchTerms(user_id);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to get search terms."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to get search terms."
      });
    }
  };

  /**
   * Get stored job types.
   * @param req params.user_id
   */
  const getJobTypesRoute = async (req: GetJobTypesRequest, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to get job types."
      });
      return;
    }

    try {
      const result = await getJobTypes(user_id);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to get job types."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to get job types."
      });
    }
  }

  /**
   * Update interests list.
   * @param req params.user_id, body interests array
   */
  const updateUserInterestsRoute = async (req: UpdateInterestsRequest, res: Response) => {
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

  /**
   * Regenerate search terms from resume + interests.
   * @param req params.user_id
   */
  const updateSearchTermsRoute = async (req: UpdateSearchTermsRequest, res: Response) => {
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

  /**
   * Update preferred job types.
   * @param req params.user_id, body job_types array
   */
  const updateJobTypeRoute = async (req: UpdateJobTypesRequest, res: Response) => {
    const { user_id } = req.params;
    const { job_types } = req.body;

    if (!user_id || !job_types) {
      res.status(404).json({
        "message": "Required arguments not found to update job interests."
      });
      return;
    }

    try {
      const result = await updateJobType(user_id, job_types);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to update job types."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to update job types."
      });
    }
  }

  /**
   * Cache short resume summary.
   * @param req params.user_id
   */
  const cacheShortResumeRoute = async (req: CacheShortResumeRequest, res: Response) => {
    const { user_id } = req.params;

    if (!user_id) {
      res.status(404).json({
        "message": "Required arguments not found to cache resume."
      });
      return;
    }

    try {
      const result = await cacheShortResume(user_id);

      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to cache resume."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to cache resume."
      });
    }
  }

  router.post('/new', addUserRoute);
  router.get('/:user_id', getUserRoute);
  router.put('/:user_id', updateUserRoute);
  router.get('/:user_id/preferences', getPreferencesRoute);
  router.put('/:user_id/preferences', updatePreferencesRoute);
  router.get('/:user_id/interests', getUserInterestsRoute);
  router.put('/:user_id/interests', updateUserInterestsRoute);
  router.put('/:user_id/job-types', updateJobTypeRoute);
  router.get('/:user_id/job-types', getJobTypesRoute);
  router.put('/:user_id/search-terms', updateSearchTermsRoute);
  router.get('/:user_id/search-terms', getSearchTermsRoute);
  router.post('/:user_id/cache-short-resume', cacheShortResumeRoute)
  return router;
};

export default userController;