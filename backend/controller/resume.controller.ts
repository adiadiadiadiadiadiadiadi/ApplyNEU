import express, { type Request, type Response } from 'express';
import type { ResumeMetadataRequest, ResumeSaveRequest, ResumeViewRequest } from '../types/resumes.ts';
import { getUploadUrl, getViewUrl, saveResume, getPossibleInterests } from '../services/resume.service.ts';

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

    const getInterestsRoute = async (req: Request, res: Response) => {
        const { user_id } = req.params;

        if (!user_id) {
            res.status(404).json({
                "message": "Required arguments not found to get interests."
            });
            return;
        }

        try {
            const result = await getPossibleInterests(user_id);

            if ('error' in result) {
                res.status(400).json({
                    "message": "Unable to get interests."
                });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to get interests."
            });
        }
    }

    router.post('/upload-url', getUploadUrlRoute);
    router.post('/view-url', getViewUrlRoute);
    router.post('/save-resume', saveResumeDataRoute)
    router.get('/:user_id/possible-interests', getInterestsRoute)
    return router;
};

export default resumeController;