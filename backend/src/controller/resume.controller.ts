import express, { type Response } from 'express';
import type {
  ResumeMetadataRequest,
  ResumeSaveRequest,
  SetPrimaryResumeRequest,
} from '../types/resumes.ts';
import { getUploadUrl, getViewUrl, completeResumeUpload, getPrimaryResume, listResumes, setPrimaryResume, getResumeSearchTerms, retryEnrichment, setEnrichmentStatus, deleteResume } from '../services/resume/resume.service.ts';
import { validateUploadUrl, validateSaveResume, validateResumeIdParam, validateSetPrimaryResume, validateDeleteResume } from './middleware/validators/resume.validate.ts';
import type { Request } from 'express';
import { authenticate } from './middleware/authenticate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';
import { getResumeEnrichmentQueue } from '../queues/resumeEnrichmentQueue.ts';

/**
 * Enqueues the enrichment job for a resume that has just been marked pending.
 * Finished jobs are removed straight away because BullMQ silently ignores an add whose
 * job id is still retained, which would leave a retried resume pending forever. If the
 * enqueue fails the resume is marked failed so the retry action is offered instead.
 */
const startEnrichment = async (resume_id: string) => {
    try {
        await getResumeEnrichmentQueue().add(
            'enrich',
            { resume_id },
            {
                jobId: resume_id,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: true,
            }
        );
    } catch (error) {
        await setEnrichmentStatus(resume_id, 'failed');
        throw error;
    }
};

const resumeController = (): express.Router => {
    const router = express.Router();

    /** POST /save-resume — finalize a resume upload and start generating its search terms. */
    const completeResumeUploadRoute = async (req: ResumeSaveRequest, res: Response) => {
        const { resume_id, key } = req.body;
        const resume = await completeResumeUpload(resume_id, key, req.auth!.userId);
        await startEnrichment(resume_id);
        res.status(200).json(resume);
    };

    /** POST /:resume_id/enrichment/retry — re-enqueue enrichment for a resume whose last run failed. */
    const retryEnrichmentRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await retryEnrichment(resume_id, req.auth!.userId);
        await startEnrichment(resume_id);
        res.status(202).json(result);
    };

    /** GET /:resume_id/search-terms — return the stored search terms for a specific resume. */
    const getSearchTermsRoute = async (req: Request<{ resume_id: string }>, res: Response) => {
        const { resume_id } = req.params;
        const result = await getResumeSearchTerms(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    router.post('/save', validateSaveResume, authenticate, asyncHandler(completeResumeUploadRoute));
    router.post('/:resume_id/enrichment/retry', validateResumeIdParam, authenticate, asyncHandler(retryEnrichmentRoute));
    router.get('/:resume_id/search-terms', validateResumeIdParam, authenticate, asyncHandler(getSearchTermsRoute));

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

    /** GET /me/resumes/:resume_id/view — generate a presigned S3 URL for the client to view a resume directly. */
    const getViewUrlRoute = async (req: SetPrimaryResumeRequest, res: Response) => {
        const { resume_id } = req.params;
        const url = await getViewUrl(resume_id, req.auth!.userId);
        res.status(200).json(url);
    };

    /** GET /me/resumes/primary — return the caller's primary resume record. */
    const getPrimaryResumeRoute = async (req: Request, res: Response) => {
        const result = await getPrimaryResume(req.auth!.userId);
        res.status(200).json(result);
    };

    /** GET /me/resumes — list the caller's resumes, newest first. */
    const listResumesRoute = async (req: Request, res: Response) => {
        const result = await listResumes(req.auth!.userId);
        res.status(200).json(result);
    };

    /** PUT /me/resumes/:resume_id/primary — point the caller's preferences at this resume. */
    const setPrimaryResumeRoute = async (req: SetPrimaryResumeRequest, res: Response) => {
        const { resume_id } = req.params;
        const result = await setPrimaryResume(resume_id, req.auth!.userId);
        res.status(200).json(result);
    };

    /** DELETE /me/resumes/:resume_id — delete one of the caller's resumes. */
    const deleteResumeRoute = async (req: SetPrimaryResumeRequest, res: Response) => {
        const { resume_id } = req.params;
        const result = await deleteResume(resume_id, req.auth!.userId);
        // BullMQ refuses to remove a job a worker is running, so this only clears waiting or delayed jobs.
        try {
            await getResumeEnrichmentQueue().remove(resume_id);
        } catch (error) {
            console.error(`[deleteResume] could not remove enrichment job for resume_id=${resume_id}:`, error);
        }
        res.status(200).json(result);
    };

    router.post('/upload', validateUploadUrl, asyncHandler(getUploadUrlRoute));
    router.get('/:resume_id/view', validateResumeIdParam, asyncHandler(getViewUrlRoute));
    router.get('/primary', asyncHandler(getPrimaryResumeRoute));
    router.get('/', asyncHandler(listResumesRoute));
    router.put('/:resume_id/primary', validateSetPrimaryResume, asyncHandler(setPrimaryResumeRoute));
    router.delete('/:resume_id', validateDeleteResume, asyncHandler(deleteResumeRoute));

    return router;
};

export default resumeController;
