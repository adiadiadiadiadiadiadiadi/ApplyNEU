import express, { type Response } from 'express';
import { addJob } from '../services/job.service.ts';
import { analyzeJob } from '../services/jobRun/jobRun.service.ts';
import type { AddJobRequest, SendJobDescriptionRequest } from '../types/jobs.ts';
import { validateAddJob, validateSendJobDescription } from './middleware/validators/job.validate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const jobController = (): express.Router => {
    const router = express.Router();

    /** POST /job/add — insert a new job record by company, title, and description. */
    const addJobRoute = async (req: AddJobRequest, res: Response) => {
        const { company, title, description } = req.body;
        const result = await addJob(company, title, description);
        res.status(200).json(result);
    };

    router.post('/add', validateAddJob, asyncHandler(addJobRoute));

    return router;
};

export const meJobController = (): express.Router => {
    const router = express.Router();

    /** POST /me/jobs/analyze
     * run the posting's job thread for the caller and return its decision, score and employer instructions.
    **/
    const analyzeJobDescriptionRoute = async (req: SendJobDescriptionRequest, res: Response) => {
        const { job_description, company, title } = req.body;
        const result = await analyzeJob(req.auth!.userId, job_description, company, title);
        res.status(200).json(result);
    };

    router.post('/analyze', validateSendJobDescription, asyncHandler(analyzeJobDescriptionRoute));

    return router;
};

export default jobController;
