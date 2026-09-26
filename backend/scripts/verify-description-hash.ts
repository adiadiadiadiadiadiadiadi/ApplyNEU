import 'dotenv/config';
import { pool } from '../src/db/index.ts';
import { normalizeAndHash } from '../src/utils/hash.ts';

// Checks that every stored description_hash matches what the application would
// compute. A mismatch means the backfill normalized differently from the app,
// and every affected posting would duplicate itself on the next scrape.
// Run with: npx tsx scripts/verify-description-hash.ts
const run = async () => {
    const { rows } = await pool.query<{
        job_id: string;
        company: string;
        title: string;
        description: string;
        description_hash: string;
    }>(`SELECT job_id, company, title, description, description_hash FROM public.jobs`);

    const mismatched = rows.filter((r) => normalizeAndHash(r.description) !== r.description_hash);

    for (const row of mismatched) {
        console.log(`MISMATCH ${row.company} — ${row.title} (${row.job_id})`);
        console.log(`  stored:   ${row.description_hash}`);
        console.log(`  expected: ${normalizeAndHash(row.description)}`);
    }

    console.log(`${rows.length - mismatched.length}/${rows.length} rows match.`);
    if (mismatched.length) process.exitCode = 1;
};

run()
    .catch((e) => { console.error('Verification failed:', e); process.exitCode = 1; })
    .finally(() => pool.end());
