import express, { type Request, type Response } from 'express';
import { addJobApplication } from '../services/application.service.ts';

/**
 * This controller handles job-related routes.
 * 
 * @returns {express.Router} The router object containing the job routes.
 */
const applicationController = () => {
    const router = express.Router();

    const sendJobDescriptionRoute = async (req: Request, res: Response) => {
        const { user_id, job_id } = req.params;
        const { company, title, description } = req.body;

        if (!user_id || !job_id || !title || !description) {
            res.status(404).json({
                "message": "Required arguments not found to add job application."
            });
            return;
        }

        try {
            const result = await addJobApplication(job_id, user_id, company, title, description);
            if ('error' in result) {
                res.status(400).json({
                    "message": "Unable to add job application."
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

    router.post('/:user_id/new', sendJobDescriptionRoute);

    return router;
};

export default applicationController;