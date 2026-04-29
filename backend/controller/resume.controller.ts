import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  PossibleInterestsRequest,
  LatestResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, completeResumeUpload, getPossibleInterests, getLatestResume } from '../services/resume/resume.service.ts';
import { getSearchTerms } from '../services/user/user.ai.service.ts';
import { cacheShortResume } from '../services/resume/ai.resume.service.ts';
import { validateUploadUrl, validateSaveResume, validateUserIdParam } from './middleware/validators/resume.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const resumeController = (): express.Router => {
    const router = express.Router();

    /** POST /:user_id/upload-url — generate a presigned S3 URL for the client to upload a resume directly. */
    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { user_id } = req.params;
        const { file_name, file_type, file_size } = req.body;
        const url = await getUploadUrl(user_id, file_name, file_type, file_size);
        res.status(200).json(url);
    };

    /** POST /save-resume — finalize a resume upload by persisting its S3 key and metadata to the DB. */
    const completeResumeUploadRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key, user_id } = req.body;
        const resume = await completeResumeUpload(resume_id, key, user_id);
        res.status(200).json(resume);
        Promise.all([getSearchTerms(resume_id), cacheShortResume(resume_id)]).catch((err) => console.error('Post-upload AI tasks failed:', err));
    };

    /** GET /:user_id/possible-interests — derive interest tags from the user's latest resume via AI. */
    const getInterestsRoute = async (req: PossibleInterestsRequest, res: Response) => {
        const { user_id } = req.params;
        const result = await getPossibleInterests(user_id);
        res.status(200).json(result);
    };

    /** GET /:user_id/latest — return the most recently uploaded resume record for the user. */
    const getLatestResumeRoute = async (req: LatestResumeRequest, res: Response) => {
        const { user_id } = req.params;
        const result = await getLatestResume(user_id);
        res.status(200).json(result);
    };

    router.post('/:user_id/upload-url', validateUploadUrl, requireUser, asyncHandler(getUploadUrlRoute));
    router.post('/save-resume', validateSaveResume, asyncHandler(completeResumeUploadRoute));
    router.get('/:user_id/possible-interests', validateUserIdParam, requireUser, asyncHandler(getInterestsRoute));
    router.get('/:user_id/latest', validateUserIdParam, requireUser, asyncHandler(getLatestResumeRoute));

    return router;
};

export default resumeController;
