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

export const validateAddUser = [
    body('user_id').notEmpty().withMessage('user_id is required.'),
    body('first_name').notEmpty().withMessage('first_name is required.'),
    body('last_name').notEmpty().withMessage('last_name is required.'),
    body('email').notEmpty().withMessage('email is required.'),
    body('grad_year').notEmpty().withMessage('grad_year is required.'),
    handleValidation,
];

export const validateUserIdParam = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];

export const validateUpdateUser = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('first_name').notEmpty().withMessage('first_name is required.'),
    body('last_name').notEmpty().withMessage('last_name is required.'),
    body('email').notEmpty().withMessage('email is required.'),
    body('grad_year').notEmpty().withMessage('grad_year is required.'),
    handleValidation,
];

