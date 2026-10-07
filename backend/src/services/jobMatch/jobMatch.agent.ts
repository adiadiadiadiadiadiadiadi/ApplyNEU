import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../../errors/AppError.ts';
import { withRetry } from '../../utils/retry.ts';
import { buildMessages, buildSystem, JOB_MATCH_OUTPUT_SCHEMA, type JobMatchJob } from './jobMatch.prompt.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Scores one job for one candidate with Claude Sonnet and parses the JSON it returns, which
 * structured output holds to JOB_MATCH_OUTPUT_SCHEMA. Never touches the database.
 * @param candidateBlock - The candidate rendered by renderCandidateContext
 * @param job - The posting being scored
 * @returns The parsed model output, not yet validated or normalized
 */
export const runJobMatch = async (candidateBlock: string, job: JobMatchJob) => {
  const message = await withRetry(() => anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 16000,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: JOB_MATCH_OUTPUT_SCHEMA },
    },
    system: buildSystem(candidateBlock),
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
