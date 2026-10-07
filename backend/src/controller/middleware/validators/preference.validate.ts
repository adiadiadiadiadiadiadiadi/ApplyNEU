import { body, validationResult } from 'express-validator';

import type { Request, Response, NextFunction } from 'express';
import { isInterest } from '../../../constants/interests.ts';

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

export const validateUpdateInterests = [
    body('interests').isArray({ min: 1 }).withMessage('interests must be a non-empty array.'),
    body('interests')
        .custom((interests: unknown[]) => interests.every(isInterest))
        .withMessage('interests must only contain values from the preset list.'),
    handleValidation,
];
