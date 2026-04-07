import express, { type Response } from 'express';
import { addJobApplication, getUserApplicationStats, getUserApplications, updateApplicationStatus } from '../services/application.service.ts';
import type {
  AddApplicationRequest,
  ApplicationStatsRequest,
  GetApplicationsRequest,
  UpdateApplicationStatusRequest,
} from '../types/applications.ts';
import { validateAddApplication, validateUpdateApplicationStatus, validateUserIdParam } from './middleware/application.validate.ts';

/**
 * This controller handles application-related routes.
 * 
 * @returns {express.Router} The router object containing the job routes.
 */
const applicationController = () => {
    const router = express.Router();

    /**
     * Add a job application.
     * @param req params.user_id, body company/title/description/status
     */
    const addApplicationRoute = async (req: AddApplicationRequest, res: Response) => {
        const { user_id } = req.params;
        const { company, title, description, status } = req.body;

        try {
            const result = await addJobApplication(user_id, company, title, description, status);

            if ('error' in result) {
                res.status(400).json({
                    "message": "Unable to add job application."
                });
                return;
            }

            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(500).json({
                "message": "Internal server error: could not add job description."
            });
        }
    };

    /**
     * Route to get a job application's stats.
     * 
     * @param req request of type AddApplicationRequest.
     * @param res response, either the resulting application or a result.
     * @returns 
     */
    /**
     * Retrieve aggregate application stats for a user.
     * @param req params.user_id
     */
    const getApplicationStatsRoute = async (req: ApplicationStatsRequest, res: Response) => {
        const { user_id } = req.params;

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

    /**
     * Update status for a specific application.
     * @param req params.user_id, params.application_id, body status
     */
    const updateApplicationStatusRoute = async (req: UpdateApplicationStatusRequest, res: Response) => {
        const { user_id, application_id } = req.params;
        const { status } = req.body;

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

    /**
     * List applications for a user.
     * @param req params.user_id
     */
    const getApplicationsRoute = async (req: GetApplicationsRequest, res: Response) => {
        const { user_id } = req.params;

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

    router.post('/:user_id/new', validateAddApplication, addApplicationRoute);
    router.get('/:user_id/stats', validateUserIdParam, getApplicationStatsRoute);
    router.get('/:user_id', validateUserIdParam, getApplicationsRoute);
    router.put('/:user_id/:application_id/status', validateUpdateApplicationStatus, updateApplicationStatusRoute);

    return router;
};

export default applicationController;