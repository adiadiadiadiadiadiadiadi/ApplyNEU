import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  PossibleInterestsRequest,
} from '../types/resumes.ts';
import { getUploadUrl, completeResumeUpload, getPossibleInterests, getLatestResume, getResumeSearchTerms, getResumeInterests, updateResumeInterests } from '../services/resume/resume.service.ts';
import { getSearchTerms as generateSearchTerms } from '../services/user/user.ai.service.ts';
import { validateUploadUrl, validateSaveResume, validateResumeIdParam, validateUpdateResumeInterests } from './middleware/validators/resume.validate.ts';
import type { Request } from 'express';
import { authenticate } from './middleware/authenticate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';
import { getResumeEnrichmentQueue } from '../queues/resumeEnrichmentQueue.ts';

const resumeController = (): express.Router => {
    const router = express.Router();

    /** POST /save-resume — finalize a resume upload by persisting its S3 key and metadata to the DB. */
    const completeResumeUploadRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key } = req.body;
        const resume = await completeResumeUpload(resume_id, key, req.auth!.userId);
        res.status(200).json(resume);
    };

    /** GET /:resume_id/possible-interests — derive interest tags from the resume via AI. */
    const getInterestsRoute = async (req: PossibleInterestsRequest, res: Response) => {
        const { resume_id } = req.params;
        const result = await getPossibleInterests(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    /** GET /:resume_id/interests — return the interest tags stored on a specific resume. */
    const getResumeInterestsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await getResumeInterests(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    /**
     * PUT /:resume_id/interests — save the user's selected interest tags, then kick
     * off resume enrichment. Once interests are persisted the worker caches the short
     * resume and generates search terms from those interests (one AI pass, no re-runs).
     */
    const updateResumeInterestsRoute = async (req: Request<{ resume_id: string }, unknown, { interests: string[] }>, res: Response) => {
        const { resume_id } = req.params;
        const { interests } = req.body;
        const result = await updateResumeInterests(resume_id, interests, req.auth!.userId);

        // Enqueue after interests are saved (the worker reads them) and before
        // responding, so a queue outage fails the request and the user can retry
        // rather than finishing onboarding with a resume that never gets enriched.
        await getResumeEnrichmentQueue().add(
            'enrich',
            { resume_id },
            {
                jobId: resume_id,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: 1000,
                removeOnFail: 5000,
            }
        );

        res.status(200).json(result);
    };

    /** GET /:resume_id/search-terms — return the stored search terms for a specific resume. */
    const getSearchTermsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await getResumeSearchTerms(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    /** PUT /:resume_id/search-terms — re-run AI to regenerate and store search terms for a specific resume. */
    const updateSearchTermsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await generateSearchTerms(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    router.post('/save', validateSaveResume, authenticate, asyncHandler(completeResumeUploadRoute));
    router.get('/:resume_id/possible-interests', validateResumeIdParam, authenticate, asyncHandler(getInterestsRoute));
    router.get('/:resume_id/interests', validateResumeIdParam, authenticate, asyncHandler(getResumeInterestsRoute));
    router.put('/:resume_id/interests', validateUpdateResumeInterests, authenticate, asyncHandler(updateResumeInterestsRoute));
    router.get('/:resume_id/search-terms', validateResumeIdParam, authenticate, asyncHandler(getSearchTermsRoute));
    router.put('/:resume_id/search-terms', validateResumeIdParam, authenticate, asyncHandler(updateSearchTermsRoute));

    return router;
};

export const meResumeController = (): express.Router => {
    const router = express.Router();

    /** POST /me/resumes/upload — generate a presigned S3 URL for the client to upload a resume directly. */
    const getUploadUrlRoute = async (req: ResumeMetadataRequest, res: Response) => {
        const { file_name, file_type, file_size } = req.body;
        const url = await getUploadUrl(req.auth!.userId, file_name, file_type, file_size);
        res.status(200).json(url);
    };

    /** GET /me/resumes/latest — return the most recently uploaded resume record for the caller. */
    const getLatestResumeRoute = async (req: Request, res: Response) => {
        const result = await getLatestResume(req.auth!.userId);
        res.status(200).json(result);
    };

    router.post('/upload', validateUploadUrl, asyncHandler(getUploadUrlRoute));
    router.get('/latest', asyncHandler(getLatestResumeRoute));

    return router;
};

export default resumeController;
