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

export const validateUploadUrl = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('file_name').notEmpty().withMessage('file_name is required.'),
    body('file_type').notEmpty().withMessage('file_type is required.'),
    body('file_size').notEmpty().withMessage('file_size is required.'),
    handleValidation,
];

export const validateViewUrl = [
    body('key').notEmpty().withMessage('key is required.'),
    handleValidation,
];

export const validateSaveResume = [
    body('resume_id').notEmpty().withMessage('resume_id is required.'),
    body('key').notEmpty().withMessage('key is required.'),
    body('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];

export const validateUserIdParam = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];
