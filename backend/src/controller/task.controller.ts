import express, { type Response } from 'express';
import type {
  PostTaskRequest,
  PostInstructionsRequest,
  ToggleTaskRequest,
  GetTasksRequest,
  ClearTasksRequest,
} from '../types/tasks.ts';
import { addTask, toggleTask, getTasks, deleteTasksForApplication } from '../services/task/task.service.ts';
import { validateAddTask, validateAddInstructions, validateTaskIdParam, validateClearTasks } from './middleware/validators/task.validate.ts';
import { authenticate } from './middleware/authenticate.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';
import { addInstructions } from '../services/task/ai.task.service.ts';

const taskController = () => {
  const router = express.Router();

  /** PUT /:task_id/complete — toggle the completed state of a task the caller owns. */
  const toggleTaskRoute = async (req: ToggleTaskRequest, res: Response) => {
    const { task_id } = req.params;
    const task = await toggleTask(task_id, req.auth!.userId);
    res.status(200).json(task);
  };

  router.put('/:task_id/complete', validateTaskIdParam, authenticate, asyncHandler(toggleTaskRoute));

  return router;
};

export const meTaskController = () => {
  const router = express.Router();

  /** POST /me/tasks/new — create a manual task for the caller, optionally linked to an application. */
  const addTaskRoute = async (req: PostTaskRequest, res: Response) => {
    const { text, description, application_id } = req.body;
    const task = await addTask(req.auth!.userId, text, description, application_id);
    res.status(200).json(task);
  };

  /** POST /me/tasks/add-instructions — parse employer instructions with AI and generate tasks for an application. */
  const addInstructionsRoute = async (req: PostInstructionsRequest, res: Response) => {
    const { employer_instructions, application_id, company, title } = req.body;
    const task = await addInstructions(req.auth!.userId, employer_instructions, application_id, company, title);
    res.status(200).json(task);
  };

  /** GET /me/tasks — return the caller's tasks; pass ?includeCompleted=true to include finished tasks. */
  const getTasksRoute = async (req: GetTasksRequest, res: Response) => {
    const includeCompleted = String(req.query?.includeCompleted ?? '').toLowerCase() === 'true';
    const task = await getTasks(req.auth!.userId, includeCompleted);
    res.status(200).json(task);
  };

  /** DELETE /me/tasks/application/:application_id — remove all tasks associated with a specific application. */
  const clearTasksForApplicationRoute = async (req: ClearTasksRequest, res: Response) => {
    const { application_id } = req.params;
    const result = await deleteTasksForApplication(req.auth!.userId, application_id);
    res.status(200).json(result);
  };

  router.post('/new', validateAddTask, asyncHandler(addTaskRoute));
  router.post('/add-instructions', validateAddInstructions, asyncHandler(addInstructionsRoute));
  router.delete('/application/:application_id', validateClearTasks, asyncHandler(clearTasksForApplicationRoute));
  router.get('/', asyncHandler(getTasksRoute));

  return router;
};

export default taskController;
