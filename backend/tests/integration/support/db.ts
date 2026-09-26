import { afterAll, afterEach, beforeAll, beforeEach, describe } from '@jest/globals';
import { Client, type QueryResult } from 'pg';
import { adminUrl, dropTestDatabase, provisionTestDatabase } from './database.ts';

const canReachPostgres = async () => {
  const client = new Client({ connectionString: adminUrl(), connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
};

export const databaseAvailable = await canReachPostgres();

if (!databaseAvailable) {
  console.warn(
    `Skipping integration tests: no Postgres at ${adminUrl()}. Start one with "docker compose --profile test up -d postgres-test".`
  );
}

export const describeWithDatabase: typeof describe.skip = databaseAvailable ? describe : describe.skip;

/**
 * Provisions a disposable database for the file, then wraps every test in a transaction
 * that is rolled back afterwards so cases cannot see each other's rows. The returned stub
 * stands in for src/db/index.ts so the service under test runs inside that transaction.
 */
export const useTestDatabase = () => {
  let database = '';
  let client: Client | null = null;

  beforeAll(async () => {
    const provisioned = await provisionTestDatabase();
    database = provisioned.database;
    client = new Client({ connectionString: provisioned.url });
    await client.connect();
  }, 60_000);

  afterAll(async () => {
    await client?.end();
    client = null;
    if (database) await dropTestDatabase(database);
  }, 60_000);

  beforeEach(async () => {
    await client!.query('BEGIN');
  });

  afterEach(async () => {
    await client!.query('ROLLBACK');
  });

  return {
    pool: {
      query: (text: string, params?: unknown[]): Promise<QueryResult<any>> =>
        client!.query(text, params as any[]),
    },
  };
};
