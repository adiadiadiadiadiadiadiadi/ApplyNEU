import { body, validationResult } from 'express-validator';

import type { Request, Response, NextFunction } from 'express';

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0]?.msg ?? 'Validation error.' });
        return;
    }
    next();
};

export const validateUpdateJobTypes = [
    body('job_types').notEmpty().withMessage('job_types is required.'),
    handleValidation,
];

