import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  PossibleInterestsRequest,
  LatestResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, completeResumeUpload, getPossibleInterests, getLatestResume, getResumeSearchTerms, getResumeInterests, updateResumeInterests } from '../services/resume/resume.service.ts';
import { getSearchTerms as generateSearchTerms } from '../services/user/user.ai.service.ts';
import { cacheShortResume } from '../services/resume/ai.resume.service.ts';
import { validateUploadUrl, validateSaveResume, validateUserIdParam, validateResumeIdParam, validateUpdateResumeInterests } from './middleware/validators/resume.validate.ts';
import type { Request } from 'express';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const resumeController = (): express.Router => {
    const router = express.Router();

    /** POST /upload/:user_id — generate a presigned S3 URL for the client to upload a resume directly. */
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
        Promise.all([generateSearchTerms(resume_id), 
            cacheShortResume(resume_id)])
            .catch((err) => console.error(
                'Post-upload AI tasks failed:', err)
            );
    };

    /** GET /:user_id/possible-interests — derive interest tags from the user's latest resume via AI. */
    const getInterestsRoute = async (req: PossibleInterestsRequest, res: Response) => {
        const { resume_id } = req.params;
        const result = await getPossibleInterests(resume_id);
        res.status(200).json(result);
    };

    /** GET /:user_id/latest — return the most recently uploaded resume record for the user. */
    const getLatestResumeRoute = async (req: LatestResumeRequest, res: Response) => {
        const { user_id } = req.params;
        const result = await getLatestResume(user_id);
        res.status(200).json(result);
    };

    /** GET /:resume_id/interests — return the interest tags stored on a specific resume. */
    const getResumeInterestsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await getResumeInterests(resume_id);
        res.status(200).json(result);
    };

    /** PUT /:resume_id/interests — replace the interest tags on a specific resume. */
    const updateResumeInterestsRoute = async (req: Request<{ resume_id: string }, unknown, { interests: string[] }>, res: Response) => {
        const { resume_id } = req.params;
        const { interests } = req.body;
        const result = await updateResumeInterests(resume_id, interests);
        res.status(200).json(result);
    };

    /** GET /:resume_id/search-terms — return the stored search terms for a specific resume. */
    const getSearchTermsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await getResumeSearchTerms(resume_id);
        res.status(200).json(result);
    };

    /** PUT /:resume_id/search-terms — re-run AI to regenerate and store search terms for a specific resume. */
    const updateSearchTermsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await generateSearchTerms(resume_id);
        res.status(200).json(result);
    };

    router.post('/upload/:user_id', validateUploadUrl, requireUser, asyncHandler(getUploadUrlRoute));
    router.post('/save', validateSaveResume, asyncHandler(completeResumeUploadRoute));

    router.get('/:resume_id/possible-interests', validateResumeIdParam, asyncHandler(getInterestsRoute));
    
    router.get('/:user_id/latest', validateUserIdParam, requireUser, asyncHandler(getLatestResumeRoute));

    router.get('/:resume_id/interests', validateResumeIdParam, asyncHandler(getResumeInterestsRoute));
    router.put('/:resume_id/interests', validateUpdateResumeInterests, asyncHandler(updateResumeInterestsRoute));

    router.get('/:resume_id/search-terms', validateResumeIdParam, asyncHandler(getSearchTermsRoute));
    router.put('/:resume_id/search-terms', validateResumeIdParam, asyncHandler(updateSearchTermsRoute));

    return router;
};

export default resumeController;
