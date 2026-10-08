import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../../errors/AppError.ts';
import { withRetry } from '../../utils/retry.ts';
import {
  buildMessages, buildSystem, JOB_MATCH_OUTPUT_SCHEMA, JOB_MATCH_SCORE_ONLY_SCHEMA, type JobMatchJob,
} from './jobMatch.prompt.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Scores one job for one candidate with Claude Haiku and parses the JSON it returns, which
 * structured output holds to the schema for the variant sent. Never touches the database.
 * @param candidateBlock - The candidate rendered by renderCandidateContext
 * @param job - The posting being scored
 * @param withExtraction - Also extract the posting's instructions; false when the memo has them
 * @returns The parsed model output, not yet validated or normalized
 */
export const runJobMatch = async (candidateBlock: string, job: JobMatchJob, withExtraction: boolean) => {
  const message = await withRetry(() => anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    output_config: {
      format: {
        type: 'json_schema',
        schema: withExtraction ? JOB_MATCH_OUTPUT_SCHEMA : JOB_MATCH_SCORE_ONLY_SCHEMA,
      },
    },
    system: buildSystem(candidateBlock, withExtraction),
    messages: buildMessages(job),
  }));

  if (message.stop_reason === 'refusal') {
    console.error('Model refused to provide a job match.');
    throw new AppError(502, `Job match was declined by the model. ${message.stop_details?.category}`);
  }

  const text = message.content.find((block) => block.type === 'text');
  if (!text) {
    throw new AppError(502, 'Error with API.');
  }

  return JSON.parse(text.text);
};
