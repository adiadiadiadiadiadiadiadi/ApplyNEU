import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { fileURLToPath } from 'node:url';

const SCHEMA_PATH = fileURLToPath(new URL('../../../db/schema.sql', import.meta.url));

export const ADMIN_URL_ENV = 'TEST_DATABASE_URL';
export const TEST_DB_URL_ENV = 'APPLYNEU_TEST_DATABASE_URL';
export const TEST_DB_NAME_ENV = 'APPLYNEU_TEST_DATABASE_NAME';

const DEFAULT_ADMIN_URL = 'postgres://postgres:postgres@localhost:5433/postgres';

// Supabase owns auth.users in the real database, and schema.sql points public.users at it.
// The disposable database gets the two columns the schema and its signup trigger touch.
const AUTH_SCHEMA = `
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE auth.users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb NOT NULL
  );
`;

export const adminUrl = () => process.env[ADMIN_URL_ENV] ?? DEFAULT_ADMIN_URL;

const withUrlDatabase = (url: string, database: string) => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
};

const connect = async (url: string) => {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
};

export const provisionTestDatabase = async () => {
  const database = `applyneu_test_${process.pid}_${Date.now().toString(36)}`;
  const admin = await connect(adminUrl());
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }

  const url = withUrlDatabase(adminUrl(), database);
  const target = await connect(url);
  try {
    await target.query(AUTH_SCHEMA);
    await target.query(await readFile(SCHEMA_PATH, 'utf8'));
  } finally {
    await target.end();
  }

  return { database, url };
};

export const dropTestDatabase = async (database: string) => {
  const admin = await connect(adminUrl());
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
};
