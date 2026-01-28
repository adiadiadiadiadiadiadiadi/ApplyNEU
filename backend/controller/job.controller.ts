import express, { type Request, type Response } from 'express';
import { addJob, sendJobDescription } from '../services/job.service.ts';

/**
 * This controller handles job-related routes.
 * 
 * @returns {express.Router} The router object containing the job routes.
 */
const jobController = () => {
    const router = express.Router();

    const sendJobDescriptionRoute = async (req: Request, res: Response) => {
        const { user_id } = req.params;
        const { job_description } = req.body;

        if (!user_id || !job_description) {
            res.status(404).json({
                "message": "Required arguments not found to post job description."
            });
            return;
        }

        try {
            const result = await sendJobDescription(user_id, job_description);
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

    const addJobRoute = async (req: Request, res: Response) => {
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