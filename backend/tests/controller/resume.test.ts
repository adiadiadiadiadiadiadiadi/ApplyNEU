import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

const getUploadUrl =
  jest.fn<(user_id: string, file_name: string, file_type: string, file_size: number) => Promise<any>>();
const completeResumeUpload = jest.fn<(resume_id: string, key: string, user_id: string) => Promise<any>>();
const getPossibleInterests = jest.fn<(resume_id: string) => Promise<any>>();
const getLatestResume = jest.fn<(user_id: string) => Promise<any>>();
const getResumeInterests = jest.fn<(resume_id: string) => Promise<any>>();
const updateResumeInterests = jest.fn<(resume_id: string, interests: string[]) => Promise<any>>();
const getResumeSearchTerms = jest.fn<(resume_id: string) => Promise<any>>();

// Both default to resolving.
const generateSearchTerms = jest.fn<(resume_id: string) => Promise<any>>();
const cacheShortResume = jest.fn<(resume_id: string) => Promise<any>>();

const requireUser = jest.fn((_req: any, _res: any, next: any) => next());

jest.unstable_mockModule('../../src/services/resume/resume.service.ts', () => ({
  getUploadUrl,
  completeResumeUpload,
  getPossibleInterests,
  getLatestResume,
  getResumeInterests,
  updateResumeInterests,
  getResumeSearchTerms,
}));

jest.unstable_mockModule('../../src/services/user/user.ai.service.ts', () => ({
  getSearchTerms: generateSearchTerms,
}));

jest.unstable_mockModule('../../src/services/resume/ai.resume.service.ts', () => ({
  cacheShortResume,
}));

jest.unstable_mockModule('../../src/controller/middleware/requireUser.ts', () => ({
  requireUser: (req: any, res: any, next: any) => requireUser(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';
const RESUME_ID = 'resume-123';
const KEY = 'resumes/abc123.pdf';

const rejectUser = () =>
  requireUser.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  getUploadUrl.mockReset();
  completeResumeUpload.mockReset();
  getPossibleInterests.mockReset();
  getLatestResume.mockReset();
  getResumeInterests.mockReset();
  updateResumeInterests.mockReset();
  getResumeSearchTerms.mockReset();
  generateSearchTerms.mockReset();
  cacheShortResume.mockReset();
  requireUser.mockReset();
  requireUser.mockImplementation((_req: any, _res: any, next: any) => next());
  // Keep post-save AI tasks quiet by default.
  generateSearchTerms.mockResolvedValue(undefined);
  cacheShortResume.mockResolvedValue(undefined);
});

describe('POST /resumes/upload/:user_id', () => {
  const url = `/resumes/upload/${USER_ID}`;
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

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(401);
    expect(getUploadUrl).not.toHaveBeenCalled();
  });

  it('validates the body before checking the user (invalid body + missing user -> 400)', async () => {
    rejectUser();

    const res = await request(app).post(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('file_name is required.');
    expect(requireUser).not.toHaveBeenCalled();
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
  const validBody = { resume_id: RESUME_ID, key: KEY, user_id: USER_ID };

  it('returns 200 and the completed resume on valid input', async () => {
    const resume = { resume_id: RESUME_ID, key: KEY, user_id: USER_ID, upload_complete: true };
    completeResumeUpload.mockResolvedValue(resume);

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resume);
    expect(completeResumeUpload).toHaveBeenCalledWith(RESUME_ID, KEY, USER_ID);
  });

  it('kicks off the post-upload AI tasks after a successful save', async () => {
    completeResumeUpload.mockResolvedValue({ resume_id: RESUME_ID, upload_complete: true });

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(200);
    expect(generateSearchTerms).toHaveBeenCalledWith(RESUME_ID);
    expect(cacheShortResume).toHaveBeenCalledWith(RESUME_ID);
  });

  it.each([
    ['resume_id', { key: KEY, user_id: USER_ID }, 'resume_id is required.'],
    ['key', { resume_id: RESUME_ID, user_id: USER_ID }, 'key is required.'],
    ['user_id', { resume_id: RESUME_ID, key: KEY }, 'user_id is required.'],
  ])('returns 400 when %s is missing', async (_label, body, message) => {
    const res = await request(app).post(url).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    expect(completeResumeUpload).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the record does not match a pending upload', async () => {
    completeResumeUpload.mockRejectedValue(new AppError(404, 'Resume not found or already completed.'));

    const res = await request(app).post(url).send(validBody);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found or already completed.');
    expect(generateSearchTerms).not.toHaveBeenCalled();
    expect(cacheShortResume).not.toHaveBeenCalled();
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
    expect(getPossibleInterests).toHaveBeenCalledWith(RESUME_ID);
  });

  it('propagates a 404 AppError when the resume does not exist', async () => {
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
});

describe('GET /resumes/:user_id/latest', () => {
  const url = `/resumes/${USER_ID}/latest`;

  it('returns 200 and the latest resume record', async () => {
    const resume = { resume_id: RESUME_ID, file_name: 'cv.pdf', key: KEY, file_size_bytes: 12345, created_at: '2026-01-01' };
    getLatestResume.mockResolvedValue(resume);

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(resume);
    expect(getLatestResume).toHaveBeenCalledWith(USER_ID);
  });

  it('propagates a 404 AppError when no resume exists for the user', async () => {
    getLatestResume.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).get(url);

    expect(res.status).toBe(401);
    expect(getLatestResume).not.toHaveBeenCalled();
  });
});

describe('GET /resumes/:resume_id/interests', () => {
  const url = `/resumes/${RESUME_ID}/interests`;

  it('returns 200 and the stored interests', async () => {
    getResumeInterests.mockResolvedValue({ interests: ['Python', 'React'] });

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ interests: ['Python', 'React'] });
    expect(getResumeInterests).toHaveBeenCalledWith(RESUME_ID);
  });

  it('propagates a 404 AppError when the resume does not exist', async () => {
    getResumeInterests.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
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
    expect(updateResumeInterests).toHaveBeenCalledWith(RESUME_ID, interests);
  });

  it('returns 400 when interests is missing', async () => {
    const res = await request(app).put(url).send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('interests is required.');
    expect(updateResumeInterests).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the resume does not exist', async () => {
    updateResumeInterests.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).put(url).send({ interests });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
  });
});

describe('GET /resumes/:resume_id/search-terms', () => {
  const url = `/resumes/${RESUME_ID}/search-terms`;

  it('returns 200 and the stored search terms', async () => {
    getResumeSearchTerms.mockResolvedValue({ search_terms: ['software engineer', 'backend'] });

    const res = await request(app).get(url);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ search_terms: ['software engineer', 'backend'] });
    expect(getResumeSearchTerms).toHaveBeenCalledWith(RESUME_ID);
  });

  it('propagates a 404 AppError when the resume does not exist', async () => {
    getResumeSearchTerms.mockRejectedValue(new AppError(404, 'Resume not found.'));

    const res = await request(app).get(url);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Resume not found.');
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
    expect(generateSearchTerms).toHaveBeenCalledWith(RESUME_ID);
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    generateSearchTerms.mockRejectedValue(new Error('boom'));

    const res = await request(app).put(url).send({});

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

export { USER_ID };
