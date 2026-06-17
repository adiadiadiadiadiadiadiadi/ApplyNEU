import type { Request, Response, NextFunction, RequestHandler } from 'express';

const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req as T, res, next)).catch(next);

export default asyncHandler;
