import 'dotenv/config';
import { pool } from '../src/db/index.ts';

// Truncates every table in the public schema (keeps the schema, drops all rows).
// Run with: npm run db:reset
const run = async () => {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  if (rows.length === 0) {
    console.log('No tables in public schema. Nothing to do.');
    return;
  }

  const tableList = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
  console.log(`Reset ${process.env.DB_NAME}@${process.env.DB_HOST}: truncated ${rows.length} tables (${rows.map((r) => r.tablename).join(', ')}).`);
};

run()
  .catch((e) => { console.error('Reset failed:', e); process.exitCode = 1; })
  .finally(() => pool.end());
