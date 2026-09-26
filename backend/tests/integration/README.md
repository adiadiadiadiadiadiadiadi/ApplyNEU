# Integration tests

These tests run against a real Postgres so that constraint behaviour — `ON CONFLICT`
targets, unique violations, cascades — is exercised by the database rather than asserted
against a mocked SQL string.

## Running them

```
docker compose --profile test up -d postgres-test
cd backend && npm run test:integration
```

`npm test` runs the unit suite only and never touches a database. `npm run test:integration`
points at the `postgres-test` service above by default, overridable through the standard
libpq variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`), and skips every test, exiting 0,
when nothing is listening there.

## How isolation works

Each test file provisions its own disposable database from `backend/db/schema.sql` and drops
it afterwards. `useTestDatabase()` wraps every individual test in a transaction that is rolled
back on the way out, and returns a stub that test files pass to
`jest.unstable_mockModule('../../src/db/index.ts', ...)` so the service under test runs inside
that transaction.

Supabase owns `auth.users` in the real database; the harness creates a minimal stand-in before
applying the schema so the `public.users` foreign key and the signup trigger both work.
