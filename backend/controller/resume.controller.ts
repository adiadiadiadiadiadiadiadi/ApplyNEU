import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  PossibleInterestsRequest,
  LatestResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, completeResumeUpload, getPossibleInterests, getLatestResume } from '../services/resume.service.ts';
import { validateUploadUrl, validateSaveResume, validateUserIdParam } from './middleware/validators/resume.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const resumeController = (): express.Router => {
    const router = express.Router();

    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { user_id } = req.params;
        const { file_name, file_type, file_size } = req.body;
        const url = await getUploadUrl(user_id, file_name, file_type, file_size);
        res.status(200).json(url);
    };

    const completeResumeUploadRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key, user_id } = req.body;
        const resume = await completeResumeUpload(resume_id, key, user_id);
        res.status(200).json(resume);
    };

    const getInterestsRoute = async (req: PossibleInterestsRequest, res: Response) => {
        const { user_id } = req.params;
        const result = await getPossibleInterests(user_id);
        res.status(200).json(result);
    };

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
