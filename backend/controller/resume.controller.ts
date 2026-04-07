import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  ResumeViewRequest,
  PossibleInterestsRequest,
  LatestResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, getViewUrl, saveResume, getPossibleInterests, getLatestResume } from '../services/resume.service.ts';
import { validateUploadUrl, validateViewUrl, validateSaveResume, validateUserIdParam } from './middleware/resume.validate.ts';

/**
 * This controller handles user-related routes.
 * 
 * @returns {express.Router} The router object containing the words routes.
 */
const resumeController = () => {
    const router = express.Router();

    /**
     * Generate presigned upload URL for a resume PDF.
     * @param req body file_name/file_type/file_size
     */
    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { file_name, file_type, file_size } = req.body;

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

    /**
     * Generate presigned view URL for a stored resume.
     * @param req body key
     */
    const getViewUrlRoute = async (req: ResumeViewRequest, res: Response) => {
        const { key } = req.body;

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

    /**
     * Persist resume metadata and extracted text.
     * @param req body resume_id/key/user_id/file_name/file_size_bytes
     */
    const saveResumeDataRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key, user_id, file_name, file_size_bytes } = req.body

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

    /**
     * Infer possible interests from latest resume.
     * @param req params.user_id
     */
    const getInterestsRoute = async (req: PossibleInterestsRequest, res: Response) => {
        const { user_id } = req.params;

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

    /**
     * Fetch most recent resume metadata.
     * @param req params.user_id
     */
    const getLatestResumeRoute = async (req: LatestResumeRequest, res: Response) => {
        const { user_id } = req.params;

        try {
            const result = await getLatestResume(user_id);

            if ('error' in result) {
                res.status(404).json({
                    "message": "Unable to find resume."
                });
                return;
            }
            res.status(200).json(result);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Unable to get latest resume."
            });
        }
    }

    router.post('/upload-url', validateUploadUrl, getUploadUrlRoute);
    router.post('/view-url', validateViewUrl, getViewUrlRoute);
    router.post('/save-resume', validateSaveResume, saveResumeDataRoute);
    router.get('/:user_id/possible-interests', validateUserIdParam, getInterestsRoute);
    router.get('/:user_id/latest', validateUserIdParam, getLatestResumeRoute);
    return router;
};

export default resumeController;