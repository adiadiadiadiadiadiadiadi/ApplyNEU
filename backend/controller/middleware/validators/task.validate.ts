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

export const validateAddTask = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('text').notEmpty().withMessage('text is required.'),
    body('description').notEmpty().withMessage('description is required.'),
    handleValidation,
];

export const validateAddInstructions = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    body('employer_instructions').notEmpty().withMessage('employer_instructions is required.'),
    handleValidation,
];

export const validateTaskIdParam = [
    param('task_id').notEmpty().withMessage('task_id is required.'),
    handleValidation,
];

export const validateUserIdParam = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    handleValidation,
];

export const validateClearTasks = [
    param('user_id').notEmpty().withMessage('user_id is required.'),
    param('application_id').notEmpty().withMessage('application_id is required.'),
    handleValidation,
];
