import { body, param, validationResult } from 'express-validator';

import type { Request, Response, NextFunction } from 'express';

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0]?.msg ?? 'Validation error.' });
        return;
    }
    next();
};

export const validateUserIdParam = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];


export const validateUpdateJobTypes = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('job_types').notEmpty().withMessage('job_types is required.'),
    handleValidation,
];

