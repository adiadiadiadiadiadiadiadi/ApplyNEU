import express, { type Response } from 'express';
import type {
  PostTaskRequest,
  PostInstructionsRequest,
  ToggleTaskRequest,
  GetTasksRequest,
  ClearTasksRequest,
} from '../types/tasks.ts';
import { addInstructions, addTask, toggleTask, getTasks, deleteTasksForApplication } from '../services/task.service.ts';
import { validateAddTask, validateAddInstructions, validateTaskIdParam, validateUserIdParam, validateClearTasks } from './middleware/validators/task.validate.ts';
import { requireUser } from './middleware/requireUser.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

const taskController = () => {
  const router = express.Router();

  const addTaskRoute = async (req: PostTaskRequest, res: Response) => {
    const { user_id } = req.params;
    const { text, description, application_id } = req.body;
    const task = await addTask(user_id, text, description, application_id);
    res.status(200).json(task);
  };

  const addInstructionsRoute = async (req: PostInstructionsRequest, res: Response) => {
    const { user_id } = req.params;
    const { employer_instructions, application_id, company, title } = req.body;
    const task = await addInstructions(user_id, employer_instructions, application_id, company, title);
    res.status(200).json(task);
  };

  const toggleTaskRoute = async (req: ToggleTaskRequest, res: Response) => {
    const { task_id } = req.params;
    const task = await toggleTask(task_id);
    res.status(200).json(task);
  };

  const getTasksRoute = async (req: GetTasksRequest, res: Response) => {
    const { user_id } = req.params;
    const includeCompleted = String(req.query?.includeCompleted ?? '').toLowerCase() === 'true';
    const task = await getTasks(user_id, includeCompleted);
    res.status(200).json(task);
  };

  const clearTasksForApplicationRoute = async (req: ClearTasksRequest, res: Response) => {
    const { user_id, application_id } = req.params;
    const result = await deleteTasksForApplication(user_id, application_id);
    res.status(200).json(result);
  };

  router.post('/:user_id/new', validateAddTask, requireUser, asyncHandler(addTaskRoute));
  router.post('/:user_id/add-instructions', validateAddInstructions, requireUser, asyncHandler(addInstructionsRoute));
  router.delete('/:user_id/application/:application_id', validateClearTasks, requireUser, asyncHandler(clearTasksForApplicationRoute));
  router.put('/:task_id/complete', validateTaskIdParam, asyncHandler(toggleTaskRoute));
  router.get('/:user_id', validateUserIdParam, requireUser, asyncHandler(getTasksRoute));

  return router;
};

export default taskController;
