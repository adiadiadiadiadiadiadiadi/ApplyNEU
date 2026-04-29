import express, { type Response } from 'express';
import { addJobApplication, getUserApplications, updateApplicationStatus } from '../services/application.service.ts';
import type {
  AddApplicationRequest,
  GetApplicationsRequest,
  UpdateApplicationStatusRequest,
} from '../types/applications.ts';
import { validateAddApplication, validateUpdateApplicationStatus, validateUserIdParam } from './middleware/validators/application.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const applicationController = (): express.Router => {
    const router = express.Router();

    /** POST /:user_id/new
     * create or upsert a job application; status advances forward-only via enum ordering.
    **/
    const addApplicationRoute = async (req: AddApplicationRequest, res: Response) => {
        const { user_id } = req.params;
        const { job_id, status } = req.body;
        const result = await addJobApplication(user_id, job_id, status);
        res.status(200).json(result);
    };

    /** PUT /:user_id/:application_id/status — update the status of an existing application owned by the user. */
    const updateApplicationStatusRoute = async (req: UpdateApplicationStatusRequest, res: Response) => {
        const { user_id, application_id } = req.params;
        const { status } = req.body;
        const result = await updateApplicationStatus(user_id, application_id, status);
        res.status(200).json(result);
    };

    /** GET /:user_id — return all applications for the user, joined with job details, ordered by most recent. */
    const getApplicationsRoute = async (req: GetApplicationsRequest, res: Response) => {
        const { user_id } = req.params;
        const result = await getUserApplications(user_id);
        res.status(200).json(result);
    };

    router.post('/:user_id/new', validateAddApplication, requireUser, asyncHandler(addApplicationRoute));
    router.get('/:user_id', validateUserIdParam, requireUser, asyncHandler(getApplicationsRoute));
    router.put('/:user_id/:application_id/status', validateUpdateApplicationStatus, requireUser, asyncHandler(updateApplicationStatusRoute));

    return router;
};

export default applicationController;
