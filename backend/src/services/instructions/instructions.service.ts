import { pool } from '../../db/index.ts';
import { EXTRACTION_VERSION, INSTRUCTION_KINDS } from './instructions.prompt.ts';

export type InstructionKind = typeof INSTRUCTION_KINDS[number];

export type EmployerInstruction = { kind: InstructionKind; instruction: string; description: string };

export const NON_REQUIRED_TASK_PATTERN =
    /\b(ad[\s-]?block(?:er)?|pop[\s-]?up(?: blocker)?|clear (?:your )?cache|cookies?|switch (?:to )?(?:another|different) browser|disable (?:browser )?extensions?|enable javascript|incognito|private mode|vpn|proxy|firewall|antivirus|troubleshoot|workaround|tip|optional|recommended|preference)\b/i;

/**
 * Filters and deduplicates a raw list of employer instruction objects.
 * Strips items that match NON_REQUIRED_TASK_PATTERN (browser tips, optional advice, etc.)
 * and any instruction/description pair that is an exact case-insensitive duplicate.
 * An unrecognized or missing kind becomes 'other'.
 */
export const normalizeEmployerInstructions = (input: any): EmployerInstruction[] => {
  if (!Array.isArray(input)) return [];

  const dedup = new Set<string>();
  return input
    .map((item: any) => {
      if (!item || typeof item !== 'object') return null;
      const instruction = String(item.instruction ?? '').trim();
      const description = String(item.description ?? '').trim();
      if (!instruction || !description) return null;
      if (NON_REQUIRED_TASK_PATTERN.test(`${instruction} ${description}`)) return null;
      const key = `${instruction.toLowerCase()}::${description.toLowerCase()}`;
      if (dedup.has(key)) return null;
      dedup.add(key);
      const kind: InstructionKind = INSTRUCTION_KINDS.includes(item.kind) ? item.kind : 'other';
      return { kind, instruction, description };
    })
    .filter((v: EmployerInstruction | null): v is EmployerInstruction => !!v);
};

/**
 * Returns the instructions already extracted for this posting text under the current
 * EXTRACTION_VERSION, or null when it hasn't been extracted yet. An empty array is a real
 * result: the posting was extracted and requires nothing. A read failure is logged and
 * treated as a miss, so the caller extracts instead of failing.
 */
export const getInstructions = async (description_hash: string): Promise<EmployerInstruction[] | null> => {
  try {
    const result = await pool.query(
      `
        SELECT instructions
        FROM instruction_extractions
        WHERE description_hash = $1 AND extraction_version = $2;
      `,
      [description_hash, EXTRACTION_VERSION]
    );
    const row = result.rows[0];
    console.log(`[instructions] memo ${row ? 'hit' : 'miss'} description_hash=${description_hash}`);
    return row ? normalizeEmployerInstructions(row.instructions) : null;
  } catch (error) {
    console.error(`[instructions] memo read failed description_hash=${description_hash}:`, error);
    return null;
  }
};

/**
 * Stores a posting's extracted instructions under the current EXTRACTION_VERSION. The first
 * write wins, so two users extracting the same posting at once is harmless. A write failure
 * is logged and never thrown, since the caller already has the instructions.
 */
export const saveInstructions = async (description_hash: string, instructions: EmployerInstruction[]) => {
  try {
    await pool.query(
      `
        INSERT INTO instruction_extractions (description_hash, extraction_version, instructions)
        VALUES ($1, $2, $3)
        ON CONFLICT (description_hash, extraction_version) DO NOTHING;
      `,
      [description_hash, EXTRACTION_VERSION, JSON.stringify(instructions)]
    );
  } catch (error) {
    console.error(`[instructions] memo write failed description_hash=${description_hash}:`, error);
  }
};
