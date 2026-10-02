import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AppError } from '../../src/errors/AppError.ts';

class UnrecoverableError extends Error {}

let processor: (job: any) => Promise<unknown>;
const handlers: Record<string, (...args: any[]) => Promise<void>> = {};

const getSearchTerms = jest.fn<(resume_id: string) => Promise<any>>();
const setEnrichmentStatus = jest.fn<(resume_id: string, status: string) => Promise<void>>();

jest.unstable_mockModule('bullmq', () => ({
  UnrecoverableError,
  Worker: class {
    constructor(_name: string, fn: typeof processor) {
      processor = fn;
    }
    on(event: string, handler: (...args: any[]) => Promise<void>) {
      handlers[event] = handler;
    }
  },
}));

jest.unstable_mockModule('../../src/services/user/user.ai.service.ts', () => ({ getSearchTerms }));
jest.unstable_mockModule('../../src/services/resume/resume.service.ts', () => ({ setEnrichmentStatus }));
jest.unstable_mockModule('../../src/queues/connection.ts', () => ({ bullConnection: {} }));

await import('../../src/workers/resumeEnrichmentWorker.ts');

const RESUME_ID = 'resume-1';
const makeJob = (attemptsMade = 0) => ({
  id: RESUME_ID,
  data: { resume_id: RESUME_ID },
  attemptsMade,
  opts: { attempts: 3 },
});

beforeEach(() => {
  getSearchTerms.mockReset();
  setEnrichmentStatus.mockReset();
  setEnrichmentStatus.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

describe('resume enrichment worker', () => {
  it('stops retrying when the resume is not found', async () => {
    getSearchTerms.mockRejectedValue(new AppError(404, 'Resume not found.'));

    await expect(processor(makeJob())).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('lets other errors retry', async () => {
    const error = new AppError(502, 'Error extracting topics.');
    getSearchTerms.mockRejectedValue(error);

    await expect(processor(makeJob())).rejects.toBe(error);
  });

  it('marks the resume failed on an unrecoverable error even with attempts left', async () => {
    await handlers.failed!(makeJob(1), new UnrecoverableError('Resume not found.'));

    expect(setEnrichmentStatus).toHaveBeenCalledWith(RESUME_ID, 'failed');
  });

  it('leaves the resume pending while a retryable error has attempts left', async () => {
    await handlers.failed!(makeJob(1), new Error('timeout'));

    expect(setEnrichmentStatus).not.toHaveBeenCalled();
  });

  it('marks the resume failed once attempts are exhausted', async () => {
    await handlers.failed!(makeJob(3), new Error('timeout'));

    expect(setEnrichmentStatus).toHaveBeenCalledWith(RESUME_ID, 'failed');
  });
});
