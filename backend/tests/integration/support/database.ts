import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client, type ClientConfig } from 'pg';

const SCHEMA_PATH = fileURLToPath(new URL('../../../db/schema.sql', import.meta.url));

// Defaults match the throwaway postgres-test service in docker-compose.yml, which trusts
// local connections and so needs no password. Every piece comes from the standard libpq
// variables, so a server that does want credentials is configured through the environment
// rather than through anything committed here.
const ADMIN_DEFAULTS = {
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  database: 'postgres',
};

// Supabase owns auth.users in the real database, and schema.sql points public.users at it.
// The disposable database gets the two columns the schema and its signup trigger touch.
const AUTH_SCHEMA = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb NOT NULL
  );
`;

export const adminConfig = (): ClientConfig => ({
  host: process.env.PGHOST ?? ADMIN_DEFAULTS.host,
  port: Number(process.env.PGPORT ?? ADMIN_DEFAULTS.port),
  user: process.env.PGUSER ?? ADMIN_DEFAULTS.user,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? ADMIN_DEFAULTS.database,
});

export const describeAdminTarget = () => {
  const { host, port, database } = adminConfig();
  return `${host}:${port}/${database}`;
};

const connect = async (config: ClientConfig) => {
  const client = new Client(config);
  await client.connect();
  return client;
};

export const provisionTestDatabase = async () => {
  const database = `applyneu_test_${process.pid}_${Date.now().toString(36)}`;
  const admin = await connect(adminConfig());
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }

  const config = { ...adminConfig(), database };
  const target = await connect(config);
  try {
    await target.query(AUTH_SCHEMA);
    await target.query(await readFile(SCHEMA_PATH, 'utf8'));
  } finally {
    await target.end();
  }

  return { database, config };
};

export const dropTestDatabase = async (database: string) => {
  const admin = await connect(adminConfig());
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
};
