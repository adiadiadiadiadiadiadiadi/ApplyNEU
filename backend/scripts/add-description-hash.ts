import 'dotenv/config';
import { pool } from '../src/db/index.ts';
import { normalizeAndHash } from '../src/utils/hash.ts';

// One-off migration for #34: adds jobs.description_hash and moves the uniqueness
// rule from (company, title) to (company, title, description_hash).
// Run with: npx tsx scripts/add-description-hash.ts
const run = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description_hash text`);

        // Backfill in Node rather than SQL: the app's normalization collapses
        // Unicode whitespace (NBSP is common in scraped HTML) and Postgres'
        // [[:space:]] does not, so a SQL equivalent would write hashes the
        // application could never reproduce.
        const { rows } = await client.query<{ job_id: string; description: string }>(
            `SELECT job_id, description FROM public.jobs WHERE description_hash IS NULL`
        );
        for (const row of rows) {
            await client.query(`UPDATE public.jobs SET description_hash = $1 WHERE job_id = $2`, [
                normalizeAndHash(row.description),
                row.job_id,
            ]);
        }

        await client.query(`ALTER TABLE public.jobs ALTER COLUMN description_hash SET NOT NULL`);
        await client.query(
            `ALTER TABLE public.jobs
               ADD CONSTRAINT jobs_company_title_hash_uniq UNIQUE (company, title, description_hash)`
        );
        await client.query(`ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_company_title_uniq`);

        await client.query('COMMIT');
        console.log(`Migrated jobs: backfilled ${rows.length} rows, uniqueness now (company, title, description_hash).`);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

run()
    .catch((e) => { console.error('Migration failed:', e); process.exitCode = 1; })
    .finally(() => pool.end());
