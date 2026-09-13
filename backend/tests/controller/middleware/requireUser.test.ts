import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { requireUser } from '../../../src/controller/middleware/requireUser.ts';

const SECRET = 'test-jwt-secret';
const USER_ID = 'e2f1a2d0-1111-4a2a-9c3e-000000000001';
const OTHER_USER_ID = 'e2f1a2d0-1111-4a2a-9c3e-000000000002';

const makeReq = (userId: string | undefined, authHeader?: string): Request =>
  ({
    params: userId === undefined ? {} : { user_id: userId },
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  }) as unknown as Request;

const makeRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as unknown as Response['status'];
  res.json = jest.fn().mockReturnValue(res) as unknown as Response['json'];
  return res as Response;
};

const sign = (payload: object, secret: string, options?: jwt.SignOptions) =>
  jwt.sign(payload, secret, { algorithm: 'HS256', ...options });

describe('requireUser', () => {
  const originalKey = process.env.SUPABASE_JWT_KEY;

  beforeEach(() => {
    process.env.SUPABASE_JWT_KEY = SECRET;
  });

  afterEach(() => {
    process.env.SUPABASE_JWT_KEY = originalKey;
  });

  it('rejects when the route has no :user_id param', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when there is no Authorization header', () => {
    const req = makeReq(USER_ID);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a Bearer token', () => {
    const req = makeReq(USER_ID, 'Basic somecreds');
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token whose sub matches :user_id and attaches req.auth', () => {
    const token = sign({ sub: USER_ID }, SECRET);
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.auth).toEqual({ userId: USER_ID });
  });

  it('rejects with 403 when the token is valid but sub does not match :user_id', () => {
    const token = sign({ sub: OTHER_USER_ID }, SECRET);
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = sign({ sub: USER_ID }, 'wrong-secret');
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an expired token', () => {
    const token = sign({ sub: USER_ID }, SECRET, { expiresIn: -10 });
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with a different algorithm, even with the right secret', () => {
    const token = sign({ sub: USER_ID }, SECRET, { algorithm: 'HS512' });
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when SUPABASE_JWT_KEY is not configured', () => {
    delete process.env.SUPABASE_JWT_KEY;
    const token = sign({ sub: USER_ID }, SECRET);
    const req = makeReq(USER_ID, `Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
