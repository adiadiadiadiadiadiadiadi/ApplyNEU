import express, { type Request, type Response } from 'express';
import type { ResumeMetadataRequest } from '../types/resumes.ts';
import { getUploadUrl } from '../services/resume.service.ts';

/**
 * This controller handles user-related routes.
 * 
 * @returns {express.Router} The router object containing the words routes.
 */
const resumeController = () => {
    const router = express.Router();

    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { file_name, file_type, file_size } = req.body;

        if (!file_name || !file_type || !file_size) {
            res.status(404).json({
                "message": "Required arguments not found to post resume."
            });
            return;
        }

        try {
            const url = await getUploadUrl(file_name, file_type, file_size);
            console.log(url)

            if ('error' in url) {
                res.status(400).json({
                    "message": "Unable to post resume."
                });
                return;
            }
            res.status(200).json(url);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to post resume."
            });
        }
    };

    router.post('/new', getUploadUrlRoute);
    return router;
};

export default resumeController;
