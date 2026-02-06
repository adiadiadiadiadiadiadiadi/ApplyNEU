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
        const { company, title, description } = req.body;
        console.log("hahahha")

        if (!user_id || !title || !description || !company) {
            res.status(404).json({
                "message": "Required arguments not found to add job application."
            });
            return;
        }

        try {
            console.log('[application] saving application', { user_id, company, title });
            const result = await addJobApplication(user_id, company, title, description);
            if ('error' in result) {
                console.error('[application] save failed', result.error);
                res.status(400).json({
                    "message": "Unable to add job application."
                });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            console.error('[application] unexpected error', err);
            res.status(400).json({
                "message": "Unable to send job description."
            });
        }
    };

    router.post('/:user_id/new', addApplicationRoute);

    return router;
};

export default applicationController;