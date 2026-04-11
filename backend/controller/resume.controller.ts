import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  ResumeViewRequest,
  PossibleInterestsRequest,
  LatestResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, completeResumeUpload, getPossibleInterests, getLatestResume } from '../services/resume.service.ts';
import { validateUploadUrl, validateViewUrl, validateSaveResume, validateUserIdParam } from './middleware/resume.validate.ts';

/**
 * This controller handles user-related routes.
 * 
 * @returns {express.Router} The router object containing the words routes.
 */
const resumeController = (): express.Router => {
    const router = express.Router();

    /**
     * Generate presigned upload URL for a resume PDF.
     * @param req params.user_id body file_name/file_type/file_size
     */
    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { user_id } = req.params;
        const { file_name, file_type, file_size } = req.body;

        try {
            const url = await getUploadUrl(user_id, file_name, file_type, file_size);

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
     * Persist resume metadata and extracted text.
     * @param req body resume_id/key/user_id/file_name/file_size_bytes
     */
    const completeResumeUploadRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key, user_id } = req.body

        try {
            const resume = await completeResumeUpload(resume_id, key, user_id);
            if ('error' in resume) {
                res.status(400).json({
                    "message": "Resume upload not complete."
                });
                return;
            }
            res.status(200).json(resume);
        } catch (err: unknown) {
            res.status(400).json({
                "message": "Resume upload not complete."
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

    router.post('/:user_id/upload-url', validateUploadUrl, getUploadUrlRoute);
    router.post('/save-resume', validateSaveResume, completeResumeUploadRoute);
    router.get('/:user_id/possible-interests', validateUserIdParam, getInterestsRoute);
    router.get('/:user_id/latest', validateUserIdParam, getLatestResumeRoute);
    return router;
};

export default resumeController;