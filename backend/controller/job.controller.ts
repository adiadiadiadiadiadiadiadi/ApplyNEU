import express, { type Request, type Response } from 'express';
import { sendJobDescription } from '../services/job.service.ts';

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
            console.log(result)
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

    router.post('/:user_id/send-job', sendJobDescriptionRoute);

    return router;
};

export default jobController;