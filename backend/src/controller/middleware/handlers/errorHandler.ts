import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../errors/AppError.ts';

const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        if (err.retryAfter !== undefined) res.set('Retry-After', String(err.retryAfter));
        res.status(err.status).json({ message: err.message });
        return;
    }
    console.error('[errorHandler] unhandled error:', err);
    res.status(500).json({ message: 'Internal server error.' });
};

export default errorHandler;
