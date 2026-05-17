import express, { type Response } from 'express';
import { addJob, sendJobDescription } from '../services/job.service.ts';
import type { AddJobRequest, SendJobDescriptionRequest } from '../types/jobs.ts';
import { validateAddJob, validateSendJobDescription } from './middleware/validators/job.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const jobController = (): express.Router => {
    const router = express.Router();

    /** POST /analyze/:user_id
     * analyze a job description using Claude Haiku and return matched resume/interest data for the user.
    **/
    const analyzeJobDescriptionRoute = async (req: SendJobDescriptionRequest, res: Response) => {
        const { user_id } = req.params;
        const { job_description, company, title } = req.body;
        const result = await sendJobDescription(user_id, job_description, company, title);
        res.status(200).json(result);
    };

    /** POST /job/add — insert a new job record by company, title, and description. */
    const addJobRoute = async (req: AddJobRequest, res: Response) => {
        const { company, title, description } = req.body;
        const result = await addJob(company, title, description);
        res.status(200).json(result);
    };

    router.post('/analyze/:user_id', validateSendJobDescription, requireUser, asyncHandler(analyzeJobDescriptionRoute));
    router.post('/add', validateAddJob, asyncHandler(addJobRoute));

    return router;
};

export default jobController;
