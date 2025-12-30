import express, { type Response } from 'express';
import type { ResumeMetadataRequest, ResumeSaveRequest, ResumeViewRequest } from '../types/resumes.ts';
import { getUploadUrl, getViewUrl, saveResume } from '../services/resume.service.ts';

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

    const getViewUrlRoute = async (req: ResumeViewRequest, res: Response) => {
        const { key } = req.body;

        if (!key) {
            res.status(404).json({
                "message": "Required arguments not found to view resume."
            });
            return;
        }

        try {
            const url = await getViewUrl(key);

            if ('error' in url) {
                res.status(400).json({
                    "message": "Unable to view resume."
                });
                return;
            }
            res.status(200).json(url);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to view resume."
            });
        }
    }

    const saveResumeDataRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key, user_id, file_name, file_size_bytes } = req.body

        if (!resume_id || !key || !user_id || !file_name || !file_size_bytes) {
            res.status(404).json({
                "message": "Required arguments not found to save resume."
            });
            return;
        }

        try {
            const resume = await saveResume(resume_id, key, user_id, file_name, file_size_bytes);
            console.log("resume", resume)
            if ('error' in resume) {
                res.status(400).json({
                    "message": "Unable to save resume."
                });
                return;
            }
            res.status(200).json(resume);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to save resume."
            });
        }
    }

    router.post('/upload-url', getUploadUrlRoute);
    router.post('/view-url', getViewUrlRoute);
    router.post('/save-resume', saveResumeDataRoute)
    return router;
};

export default resumeController;