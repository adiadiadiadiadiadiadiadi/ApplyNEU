import express, { type Response } from 'express';
import { addJob, sendJobDescription } from '../services/job.service.ts';
import type { AddJobRequest, SendJobDescriptionRequest } from '../types/jobs.ts';
import { validateAddJob, validateSendJobDescription } from './middleware/validators/job.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const jobController = (): express.Router => {
    const router = express.Router();

    const sendJobDescriptionRoute = async (req: SendJobDescriptionRequest, res: Response) => {
        const { user_id } = req.params;
        const { job_description, company, title } = req.body;
        const result = await sendJobDescription(user_id, job_description, company, title);
        res.status(200).json(result);
    };

    const addJobRoute = async (req: AddJobRequest, res: Response) => {
        const { company, title, description } = req.body;
        const result = await addJob(company, title, description);
        res.status(200).json(result);
    };

    router.post('/:user_id/send-job', validateSendJobDescription, requireUser, asyncHandler(sendJobDescriptionRoute));
    router.post('/add-job', validateAddJob, asyncHandler(addJobRoute));

    return router;
};

export default jobController;
