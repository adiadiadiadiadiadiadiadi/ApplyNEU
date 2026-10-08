import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { pool } from '../src/db/index.ts';
import { getCandidateContext, renderCandidateContext } from '../src/services/candidateContext/candidateContext.service.ts';
import { buildSystem } from '../src/services/jobMatch/jobMatch.prompt.ts';

// Measures the job match system block for one user, with and without the extraction rules.
// Run with: npx tsx scripts/count-job-match-tokens.ts <user_id>
const MODEL = 'claude-sonnet-5-5';
const anthropic = new Anthropic();
const messages: Anthropic.MessageParam[] = [{ role: 'user', content: 'x' }];

const count = async (system?: Anthropic.TextBlockParam[]) =>
  (await anthropic.messages.countTokens({ model: MODEL, messages, ...(system ? { system } : {}) })).input_tokens;

const run = async () => {
  const userId = process.argv[2];
  if (!userId) throw new Error('Usage: npx tsx scripts/count-job-match-tokens.ts <user_id>');

  const context = await getCandidateContext(userId);
  if (!context.resume?.resume_text) throw new Error('That user has no resume.');

  const candidateBlock = renderCandidateContext({ ...context, resume: context.resume });
  const full = buildSystem(candidateBlock, true);
  const scoringOnly = buildSystem(candidateBlock, false);

  const baseline = await count();
  console.log(`resume length: ${context.resume.resume_text.length} chars`);
  console.log(`system with extraction rules:    ${(await count(full)) - baseline} tokens`);
  console.log(`system without extraction rules: ${(await count(scoringOnly)) - baseline} tokens`);
  console.log('Sonnet 5.5 minimum cacheable prefix: 512 tokens');
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
