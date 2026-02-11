import express, { type Request, type Response } from 'express';
import { addJobApplication, getUserApplicationStats } from '../services/application.service.ts';

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

    const getApplicationStatsRoute = async (req: Request, res: Response) => {
        const { user_id } = req.params;

        if (!user_id) {
            res.status(404).json({
                "message": "Required arguments not found to get stats."
            });
            return;
        }

        try {
            const stats = await getUserApplicationStats(user_id);
            if ('error' in stats) {
                res.status(400).json({
                    "message": "Unable to fetch job application stats."
                });
                return;
            }
            res.status(200).json(stats);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to fetch job application stats."
            });
        }
    };

    router.post('/:user_id/new', addApplicationRoute);
    router.get('/:user_id/stats', getApplicationStatsRoute);

    return router;
};

export default applicationController;