import express, { type Request, type Response } from 'express';
import { addJobApplication, getUserApplications, updateApplicationStatus } from '../services/application.service.ts';
import type {
  AddApplicationRequest,
  UpdateApplicationStatusRequest,
} from '../types/applications.ts';
import { validateAddApplication, validateUpdateApplicationStatus } from './middleware/validators/application.validate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

export const meApplicationController = (): express.Router => {
    const router = express.Router();

    /** POST /me/applications/new
     * create a job application for the caller.
    **/
    const addApplicationRoute = async (req: AddApplicationRequest, res: Response) => {
        const { job_id, status } = req.body;
        const result = await addJobApplication(req.auth!.userId, job_id, status);
        res.status(200).json(result);
    };

    /** PUT /me/applications/:application_id/status
     * update the status of an existing application owned by the caller.
    **/
    const updateApplicationStatusRoute = async (req: UpdateApplicationStatusRequest, res: Response) => {
        const { application_id } = req.params;
        const { status } = req.body;
        const result = await updateApplicationStatus(req.auth!.userId, application_id, status);
        res.status(200).json(result);
    };

    /** GET /me/applications
     * return all applications for the caller, joined with job details, ordered by most recent.
    **/
    const getApplicationsRoute = async (req: Request, res: Response) => {
        const result = await getUserApplications(req.auth!.userId);
        res.status(200).json(result);
    };

    router.post('/new', validateAddApplication, asyncHandler(addApplicationRoute));
    router.get('/', asyncHandler(getApplicationsRoute));
    router.put('/:application_id/status', validateUpdateApplicationStatus, asyncHandler(updateApplicationStatusRoute));

    return router;
};
