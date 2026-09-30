import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../src/errors/AppError.ts';

const getUploadUrl =
  jest.fn<(user_id: string, file_name: string, file_type: string, file_size: number) => Promise<any>>();
const getViewUrl = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const completeResumeUpload = jest.fn<(resume_id: string, key: string, user_id: string) => Promise<any>>();
const getPossibleInterests = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const getPrimaryResume = jest.fn<(user_id: string) => Promise<any>>();
const listResumes = jest.fn<(user_id: string) => Promise<any>>();
const setPrimaryResume = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const getResumeInterests = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const updateResumeInterests = jest.fn<(resume_id: string, interests: string[], user_id: string) => Promise<any>>();
const getResumeSearchTerms = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const retryEnrichment = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();
const setEnrichmentStatus = jest.fn<(resume_id: string, status: string) => Promise<any>>();

// Both default to resolving.
const generateSearchTerms = jest.fn<(resume_id: string, user_id: string) => Promise<any>>();

const queueAdd = jest.fn<(...args: any[]) => Promise<any>>();

const USER_ID = 'test-user-id';

const authenticate = jest.fn((req: any, _res: any, next: any) => {
  req.auth = { userId: USER_ID };
  next();
});

jest.unstable_mockModule('../../src/services/resume/resume.service.ts', () => ({
  getUploadUrl,
  getViewUrl,
  completeResumeUpload,
  getPossibleInterests,
  getPrimaryResume,
  listResumes,
  setPrimaryResume,
  getResumeInterests,
  updateResumeInterests,
  getResumeSearchTerms,
  retryEnrichment,
  setEnrichmentStatus,
}));

jest.unstable_mockModule('../../src/services/user/user.ai.service.ts', () => ({
  getSearchTerms: generateSearchTerms,
}));

// Enrichment is enqueued, not run inline; mock the queue so tests need no Redis.
jest.unstable_mockModule('../../src/queues/resumeEnrichmentQueue.ts', () => ({
  getResumeEnrichmentQueue: () => ({ add: queueAdd }),
}));

jest.unstable_mockModule('../../src/controller/middleware/authenticate.ts', () => ({
  authenticate: (req: any, res: any, next: any) => authenticate(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const RESUME_ID = 'resume-123';
// Generated the same way getUploadUrl mints resume ids. A hand-written fixture that
// happened to be RFC-conformant is exactly what hid isUUID() rejecting seven in eight
// of the ids the service was actually producing.
const RESUME_UUID = randomUUID();
const KEY = 'resumes/abc123.pdf';

const rejectAuth = () =>
  authenticate.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  getUploadUrl.mockReset();
  completeResumeUpload.mockReset();
  getPossibleInterests.mockReset();
  getPrimaryResume.mockReset();
  listResumes.mockReset();
  setPrimaryResume.mockReset();
  getResumeInterests.mockReset();
  updateResumeInterests.mockReset();
  getResumeSearchTerms.mockReset();
  generateSearchTerms.mockReset();
  queueAdd.mockReset();
  retryEnrichment.mockReset();
  setEnrichmentStatus.mockReset();
  authenticate.mockReset();
  authenticate.mockImplementation((req: any, _res: any, next: any) => {
    req.auth = { userId: USER_ID };
    next();
  });
  // Keep post-save AI tasks quiet by default.
  generateSearchTerms.mockResolvedValue(undefined);
});

describe('POST /me/resumes/upload', () => {
  const url = '/me/resumes/upload';
  const validBody = { file_name: 'cv.pdf', file_type: 'application/pdf', file_size: 12345 };

  it('returns 200 with the presigned upload payload on valid input', async () => {
    const payload = { uploadUrl: 'https://s3/put', key: KEY, resumeId: RESUME_ID, originalFilename: 'cv.pdf' };
    getUploadUrl.mockResolvedValue(payload);

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(getUploadUrl).toHaveBeenCalledWith(USER_ID, 'cv.pdf', 'application/pdf', 12345);
  });

  it.each([
    ['file_name', { file_type: 'application/pdf', file_size: 12345 }, 'file_name is required.'],
    ['file_type', { file_name: 'cv.pdf', file_size: 12345 }, 'file_type is required.'],
    ['file_size', { file_name: 'cv.pdf', file_type: 'application/pdf' }, 'file_size is required.'],
  ])('returns 400 when %s is missing', async (_label, body, message) => {
    const res = await request(app).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(getUploadUrl).not.toHaveBeenCalled();
  });

  it('returns 400 (first error) when the body is empty', async () => {
    const res = await request(app).post(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('file_name is required.');
    expect(getUploadUrl).not.toHaveBeenCalled();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(401);
    expect(getUploadUrl).not.toHaveBeenCalled();
  });

  it('authenticates before validating the body (invalid body + rejected token -> 401)', async () => {
    rejectAuth();

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(401);
    expect(getUploadUrl).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service (e.g. 400 non-PDF / oversized)', async () => {
    getUploadUrl.mockRejectedValue(new AppError(400, 'Only PDFs under 10MB allowed.'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only PDFs under 10MB allowed.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    getUploadUrl.mockRejectedValue(new Error('boom'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('POST /resumes/save', () => {
  const url = '/resumes/save';
  const validBody = { resume_id: RESUME_ID, key: KEY };

  it('returns 200 and the completed resume on valid input', async () => {
    const resume = { resume_id: RESUME_ID, key: KEY, user_id: USER_ID, upload_complete: true };
    completeResumeUpload.mockResolvedValue(resume);

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resume);
    expect(completeResumeUpload).toHaveBeenCalledWith(RESUME_ID, KEY, USER_ID);
  });

  it('does not start enrichment on save (deferred until interests are chosen)', async () => {
    completeResumeUpload.mockResolvedValue({ resume_id: RESUME_ID, upload_complete: true });

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(queueAdd).not.toHaveBeenCalled();
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });

  it.each([
    ['resume_id', { key: KEY }, 'resume_id is required.'],
    ['key', { resume_id: RESUME_ID }, 'key is required.'],
  ])('returns 400 when %s is missing', async (_label, body, message) => {
    const res = await request(app).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(completeResumeUpload).not.toHaveBeenCalled();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(401);
    expect(completeResumeUpload).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the record does not match a pending upload', async () => {
    completeResumeUpload.mockRejectedValue(new AppError(404, 'Resume not found or already completed.'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found or already completed.');
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    completeResumeUpload.mockRejectedValue(new Error('boom'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('GET /resumes/:resume_id/possible-interests', () => {
  const url = `/resumes/${RESUME_ID}/possible-interests`;

  it('returns 200 and the list of possible interests', async () => {
    const interests = ['Python', 'FinTech', 'Machine Learning'];
    getPossibleInterests.mockResolvedValue(interests);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(interests);
    expect(getPossibleInterests).toHaveBeenCalledWith(RESUME_ID, USER_ID);
  });

  it('propagates a 404 AppError when the resume does not exist or is not owned by the caller', async () => {
    getPossibleInterests.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    getPossibleInterests.mockRejectedValue(new Error('boom'));

    const res = await request(app).get(url);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(getPossibleInterests).not.toHaveBeenCalled();
  });
});

describe('GET /me/resumes/primary', () => {
  const url = '/me/resumes/primary';

  it('returns 200 and the primary resume record', async () => {
    const resume = { resume_id: RESUME_ID, file_name: 'cv.pdf', key: KEY, file_size_bytes: 12345, created_at: '2026-01-01' };
    getPrimaryResume.mockResolvedValue(resume);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resume);
    expect(getPrimaryResume).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 and null when no resume exists for the user', async () => {
    getPrimaryResume.mockResolvedValue(null);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(getPrimaryResume).not.toHaveBeenCalled();
  });
});

describe('GET /me/resumes', () => {
  const url = '/me/resumes';

  it('returns 200 and the caller\'s resumes, newest first, flagged with is_primary', async () => {
    const resumes = [
      { resume_id: RESUME_ID, file_name: 'cv.pdf', created_at: '2026-01-02', upload_complete: true, is_primary: false },
      { resume_id: 'resume-456', file_name: 'old.pdf', created_at: '2026-01-01', upload_complete: true, is_primary: true },
    ];
    listResumes.mockResolvedValue(resumes);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resumes);
    expect(listResumes).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 and an empty list when the user has no resumes', async () => {
    listResumes.mockResolvedValue([]);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(listResumes).not.toHaveBeenCalled();
  });
});

describe('PUT /me/resumes/:resume_id/primary', () => {
  const url = `/me/resumes/${RESUME_UUID}/primary`;

  it('returns 200 and the new pointer on success', async () => {
    setPrimaryResume.mockResolvedValue({ primary_resume_id: RESUME_UUID });

    const res = await request(app).put(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ primary_resume_id: RESUME_UUID });
    expect(setPrimaryResume).toHaveBeenCalledWith(RESUME_UUID, USER_ID);
  });

  it('returns 404, not 500, for a resume the caller does not own', async () => {
    setPrimaryResume.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).put(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 400 when the resume upload has not completed', async () => {
    setPrimaryResume.mockRejectedValue(new AppError(400, 'Resume upload is not complete.'));

    const res = await request(app).put(url);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Resume upload is not complete.');
  });

  it('returns 400 without calling the service when resume_id is not a resume id', async () => {
    const res = await request(app).put('/me/resumes/not-a-uuid/primary');

    expect(res.status).toBe(400);
    expect(setPrimaryResume).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    setPrimaryResume.mockRejectedValue(new Error('boom'));

    const res = await request(app).put(url);

    expect(res.status).toBe(500);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).put(url);

    expect(res.status).toBe(401);
    expect(setPrimaryResume).not.toHaveBeenCalled();
  });
});

describe('GET /resumes/:resume_id/interests', () => {
  const url = `/resumes/${RESUME_ID}/interests`;

  it('returns 200 and the stored interests', async () => {
    getResumeInterests.mockResolvedValue({ interests: ['Python', 'React'] });

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ interests: ['Python', 'React'] });
    expect(getResumeInterests).toHaveBeenCalledWith(RESUME_ID, USER_ID);
  });

  it('propagates a 404 AppError when the resume does not exist or is not owned by the caller', async () => {
    getResumeInterests.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(getResumeInterests).not.toHaveBeenCalled();
  });
});

describe('PUT /resumes/:resume_id/interests', () => {
  const url = `/resumes/${RESUME_ID}/interests`;
  const interests = ['Python', 'React', 'AWS'];

  it('returns 200 and the updated resume on valid input', async () => {
    const updated = { resume_id: RESUME_ID, interests };
    updateResumeInterests.mockResolvedValue(updated);

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(updateResumeInterests).toHaveBeenCalledWith(RESUME_ID, interests, USER_ID);
  });

  it('enqueues enrichment once interests are saved', async () => {
    updateResumeInterests.mockResolvedValue({ resume_id: RESUME_ID, interests });

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(200);
    // Handed off to the worker rather than run inline, keyed by resume_id so a
    // repeated save does not queue duplicate work.
    expect(queueAdd).toHaveBeenCalledWith(
      'enrich',
      { resume_id: RESUME_ID },
      expect.objectContaining({ jobId: RESUME_ID, attempts: 3, removeOnComplete: true, removeOnFail: true }),
    );
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });

  it('marks enrichment failed when the job cannot be enqueued', async () => {
    updateResumeInterests.mockResolvedValue({ resume_id: RESUME_ID, interests });
    queueAdd.mockRejectedValue(new Error('redis down'));

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(500);
    expect(setEnrichmentStatus).toHaveBeenCalledWith(RESUME_ID, 'failed');
  });

  it('returns 400 when interests is missing', async () => {
    const res = await request(app).put(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('interests is required.');
    expect(updateResumeInterests).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the resume does not exist or is not owned by the caller', async () => {
    updateResumeInterests.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(401);
    expect(updateResumeInterests).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });
});

describe('GET /resumes/:resume_id/search-terms', () => {
  const url = `/resumes/${RESUME_ID}/search-terms`;

  it('returns 200 and the stored search terms', async () => {
    getResumeSearchTerms.mockResolvedValue({ search_terms: ['software engineer', 'backend'] });

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ search_terms: ['software engineer', 'backend'] });
    expect(getResumeSearchTerms).toHaveBeenCalledWith(RESUME_ID, USER_ID);
  });

  it('propagates a 404 AppError when the resume does not exist or is not owned by the caller', async () => {
    getResumeSearchTerms.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(getResumeSearchTerms).not.toHaveBeenCalled();
  });
});

describe('PUT /resumes/:resume_id/search-terms', () => {
  const url = `/resumes/${RESUME_ID}/search-terms`;

  it('returns 200 and the regenerated search terms', async () => {
    const terms = ['software engineer', 'backend', 'node'];
    generateSearchTerms.mockResolvedValue(terms);

    const res = await request(app).put(url).send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(terms);
    expect(generateSearchTerms).toHaveBeenCalledWith(RESUME_ID, USER_ID);
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    generateSearchTerms.mockRejectedValue(new Error('boom'));

    const res = await request(app).put(url).send({});

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).put(url).send({});

    expect(res.status).toBe(401);
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });
});

describe('POST /resumes/:resume_id/enrichment/retry', () => {
  const url = `/resumes/${RESUME_ID}/enrichment/retry`;

  it('returns 202 with the pending status and re-enqueues enrichment', async () => {
    retryEnrichment.mockResolvedValue({ resume_id: RESUME_ID, enrichment_status: 'pending' });

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ resume_id: RESUME_ID, enrichment_status: 'pending' });
    expect(retryEnrichment).toHaveBeenCalledWith(RESUME_ID, USER_ID);
    expect(queueAdd).toHaveBeenCalledWith(
      'enrich',
      { resume_id: RESUME_ID },
      expect.objectContaining({ jobId: RESUME_ID, attempts: 3 }),
    );
  });

  it('ignores a status in the body', async () => {
    retryEnrichment.mockResolvedValue({ resume_id: RESUME_ID, enrichment_status: 'pending' });

    const res = await request(app).post(url).send({ enrichment_status: 'complete' });

    expect(res.status).toBe(202);
    expect(res.body.enrichment_status).toBe('pending');
    expect(setEnrichmentStatus).not.toHaveBeenCalled();
  });

  it('propagates a 409 without enqueueing when the resume is not in a failed state', async () => {
    retryEnrichment.mockRejectedValue(new AppError(409, 'Only a failed enrichment with interests can be retried.'));

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(409);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('propagates a 429 without enqueueing once the retry limit is reached', async () => {
    retryEnrichment.mockRejectedValue(new AppError(429, 'Enrichment retry limit reached.'));

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(429);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('marks enrichment failed again when the retry cannot be enqueued', async () => {
    retryEnrichment.mockResolvedValue({ resume_id: RESUME_ID, enrichment_status: 'pending' });
    queueAdd.mockRejectedValue(new Error('redis down'));

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(500);
    expect(setEnrichmentStatus).toHaveBeenCalledWith(RESUME_ID, 'failed');
  });

  it('returns 401 when the caller is not authenticated', async () => {
    rejectAuth();

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(401);
    expect(retryEnrichment).not.toHaveBeenCalled();
  });
});

export { USER_ID };
