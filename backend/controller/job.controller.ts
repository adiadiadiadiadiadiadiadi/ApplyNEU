import express, { type Response } from 'express';
import { addJob, sendJobDescription } from '../services/job.service.ts';
import type { AddJobRequest, SendJobDescriptionRequest } from '../types/jobs.ts';

/**
 * This controller handles job-related routes.
 * 
 * @returns {express.Router} The router object containing the job routes.
 */
const jobController = () => {
    const router = express.Router();

    /**
     * Evaluate a job description against a user's resume and extract required steps.
     * @param req params.user_id, body job_description/company/title
     */
    const sendJobDescriptionRoute = async (req: SendJobDescriptionRequest, res: Response) => {
        const { user_id } = req.params;
        const { job_description, company, title } = req.body;

        if (!user_id || !job_description) {
            res.status(404).json({
                "message": "Required arguments not found to post job description."
            });
            return;
        }

        try {
            const result = await sendJobDescription(user_id, job_description, company, title);
            if ('error' in result) {
                res.status(400).json({
                    "message": "Unable to send job description."
                });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to send job description."
            });
        }
    };

    /**
     * Insert a job entry if not present.
     * @param req body company/title/description
     */
    const addJobRoute = async (req: AddJobRequest, res: Response) => {
        const { company, title, description } = req.body;

        if (!company || !title || !description) {
            res.status(404).json({
                "message": "Required arguments not found to add job."
            });
            return;
        }

        try {
            const result = await addJob(company, title, description);
            if ('error' in result) {
                res.status(400).json({
                    "message": "Unable to add job."
                });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to add job."
            });
        }
    }

    router.post('/:user_id/send-job', sendJobDescriptionRoute);
    router.post('/add-job', addJobRoute);

    return router;
};

export default jobController;