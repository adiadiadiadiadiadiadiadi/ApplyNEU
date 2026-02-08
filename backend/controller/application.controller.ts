import express, { type Request, type Response } from 'express';
import { addJobApplication } from '../services/application.service.ts';

/**
 * This controller handles job-related routes.
 * 
 * @returns {express.Router} The router object containing the job routes.
 */
const applicationController = () => {
    const router = express.Router();

    const addApplicationRoute = async (req: Request, res: Response) => {
        const { user_id } = req.params;
        const { company, title, description, status } = req.body;

        if (!user_id || !title || !description || !company || !status) {
            res.status(404).json({
                "message": "Required arguments not found to add job application."
            });
            return;
        }

        try {
            const result = await addJobApplication(user_id, company, title, description, status);
            if ('error' in result) {
                console.error('[application] save failed', result.error);
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

    router.post('/:user_id/new', addApplicationRoute);

    return router;
};

export default applicationController;