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

export const validateSendJobDescription = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('job_description').trim().notEmpty().withMessage('job_description is required.'),
    body('company').trim().notEmpty().withMessage('company is required.'),
    body('title').trim().notEmpty().withMessage('title is required.'),
    handleValidation,
];

export const validateAddJob = [
    body('company').trim().notEmpty().withMessage('company is required.'),
    body('title').trim().notEmpty().withMessage('title is required.'),
    body('description').trim().notEmpty().withMessage('description is required.'),
    handleValidation,
];
