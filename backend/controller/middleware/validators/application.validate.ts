import { body, param, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

/**
 * Used for validating requests and moving to next function (next middleware).
 */
const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0]?.msg ?? 'Validation error.' });
        return;
    }
    next();
};

export const validateAddApplication = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('job_id').notEmpty().withMessage('job_id is required.'),
    body('status').notEmpty().withMessage('status is required.'),
    handleValidation,
];

export const validateUserIdParam = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];

export const validateUpdateApplicationStatus = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    param('application_id').notEmpty().withMessage('application_id is required.'),
    body('status').notEmpty().withMessage('status is required.'),
    handleValidation,
];
