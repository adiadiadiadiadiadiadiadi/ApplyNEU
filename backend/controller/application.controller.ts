import express, { type Request, type Response } from 'express';
import { addJobApplication, getUserApplicationStats, getUserApplications, updateApplicationStatus } from '../services/application.service.ts';

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

    const updateApplicationStatusRoute = async (req: Request, res: Response) => {
        const { user_id, application_id } = req.params;
        const { status } = req.body ?? {};

        if (!user_id || !application_id || !status) {
            res.status(404).json({ message: 'user_id, application_id, and status are required.' });
            return;
        }

        try {
            const result = await updateApplicationStatus(user_id, application_id, status);
            if ('error' in result) {
                res.status(400).json({ message: result.error });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(400).json({ message: 'Unable to update application status.' });
        }
    };

    const getApplicationsRoute = async (req: Request, res: Response) => {
        const { user_id } = req.params;

        if (!user_id) {
            res.status(404).json({ message: 'user_id required.' });
            return;
        }

        try {
            const result = await getUserApplications(user_id);
            if ('error' in result) {
                res.status(400).json({ message: 'Unable to fetch applications.' });
                return;
            }
            res.status(200).json(result);
        } catch {
            res.status(400).json({ message: 'Unable to fetch applications.' });
        }
    };

    router.post('/:user_id/new', addApplicationRoute);
    router.get('/:user_id/stats', getApplicationStatsRoute);
    router.get('/:user_id', getApplicationsRoute);
    router.put('/:user_id/:application_id/status', updateApplicationStatusRoute);

    return router;
};

export default applicationController;