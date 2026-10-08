import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

const query = jest.fn<(text: string) => Promise<any>>();
const ping = jest.fn<() => Promise<string>>();

jest.unstable_mockModule('../../src/db/index.ts', () => ({ pool: { query } }));
jest.unstable_mockModule('../../src/db/redis.ts', () => ({ redis: { ping } }));

const { app } = await import('../../src/app.ts');
const { startDraining } = await import('../../src/health.ts');

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [{ '?column?': 1 }] });
  ping.mockReset().mockResolvedValue('PONG');
});

describe('GET /healthz', () => {
  it('returns 200 without touching Postgres or Redis', async () => {
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(query).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
  });

  it('stays 200 when Postgres is down', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
  });
});

describe('GET /readyz', () => {
  it('returns 200 when Postgres and Redis respond', async () => {
    const res = await request(app).get('/readyz');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ postgres: 'ok', redis: 'ok' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns 503 when Postgres is unreachable', async () => {
    query.mockRejectedValue(new Error('connection refused'));

    const res = await request(app).get('/readyz');

    expect(res.status).toBe(503);
    expect(res.body.postgres).toBe('down');
  });

  it('stays 200 when only Redis is down, and reports it', async () => {
    ping.mockRejectedValue(new Error('redis down'));

    const res = await request(app).get('/readyz');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ postgres: 'ok', redis: 'down' });
  });

  it('needs no auth token', async () => {
    const res = await request(app).get('/readyz');

    expect(res.status).not.toBe(401);
  });

  it('returns 503 once the instance starts draining, without checking dependencies', async () => {
    startDraining();

    const res = await request(app).get('/readyz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('draining');
    expect(query).not.toHaveBeenCalled();
  });
});
