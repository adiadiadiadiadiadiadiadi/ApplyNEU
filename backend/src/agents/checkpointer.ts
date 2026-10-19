import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { pool } from '../db/index.ts';

/**
 * Checkpoints live in their own schema rather than public, which Supabase serves through its
 * REST API to anyone holding the anon key.
 */
export const CHECKPOINT_SCHEMA = 'langgraph';

/**
 * Persists agent graph state to Supabase through the app's existing pool. Never call setup():
 * the tables come from db/schema.sql, and the comment there says what to do when a package
 * upgrade adds a checkpointer migration.
 */
export const checkpointer = new PostgresSaver(pool, undefined, { schema: CHECKPOINT_SCHEMA });
