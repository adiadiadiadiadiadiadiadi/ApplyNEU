import express, { type Response } from 'express';
import type {
  PostTaskRequest,
  PostInstructionsRequest,
  ToggleTaskRequest,
  GetTasksRequest,
  ClearTasksRequest,
} from '../types/tasks.ts';
import { addInstructions, addTask, toggleTask, getTasks, deleteTasksForApplication } from '../services/task.service.ts';
import { validateAddTask, validateAddInstructions, validateTaskIdParam, validateUserIdParam, validateClearTasks } from './middleware/task.validate.ts';

/**
 * This controller handles task-related routes.
 * 
 * @returns {express.Router} The router object containing the tasks routes.
 */
const taskController = () => {
  const router = express.Router();

  /**
   * Create a task for a user.
   * @param req params.user_id, body text/description/application_id
   */
  const addTaskRoute = async (req: PostTaskRequest, res: Response) => {
    const { user_id } = req.params;
    const { text, description, application_id } = req.body;

    try {
      const task = await addTask(user_id, text, description, application_id);

      if ('error' in task) {
        res.status(400).json({
          "message": "Unable to post task."
        });
        return;
      }
      res.status(200).json(task);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to post task."
      });
    }
  };

  /**
   * Create tasks from employer instructions payload.
   * @param req params.user_id, body employer_instructions + optional metadata
   */
  const addInstructionsRoute = async (req: PostInstructionsRequest, res: Response) => {
    const { user_id } = req.params;
    const { employer_instructions, application_id, company, title } = req.body;

    try {
      const task = await addInstructions(user_id, employer_instructions, application_id, company, title);

      if ('error' in task) {
        res.status(400).json({
          "message": "Unable to post task."
        });
        return;
      }
      res.status(200).json(task);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to post task."
      });
    }
  };

  /**
   * Toggle completion status of a task.
   * @param req params.task_id
   */
  const toggleTaskRoute = async (req: ToggleTaskRequest, res: Response) => {
    const { task_id } = req.params;

    try {
      const task = await toggleTask(task_id);

      if ('error' in task) {
        res.status(400).json({
          "message": "Unable to toggle task completion."
        });
        return;
      }
      res.status(200).json(task);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to toggle task completion."
      });
    }
  };

  /**
   * List tasks for a user.
   * @param req params.user_id, query includeCompleted=true to include done tasks
   */
  const getTasksRoute = async (req: GetTasksRequest, res: Response) => {
    const { user_id } = req.params;
    const includeCompleted = String(req.query?.includeCompleted ?? '').toLowerCase() === 'true';

    try {
      const task = await getTasks(user_id, includeCompleted);

      if ('error' in task) {
        res.status(400).json({
          "message": "Unable to get tasks."
        });
        return;
      }
      res.status(200).json(task);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to toggle task completion."
      });
    }
  };

  /**
   * Delete tasks linked to an application for a user.
   * @param req params.user_id, params.application_id
   */
  const clearTasksForApplicationRoute = async (req: ClearTasksRequest, res: Response) => {
    const { user_id, application_id } = req.params;

    try {
      const result = await deleteTasksForApplication(user_id, application_id);
      if ('error' in result) {
        res.status(400).json({
          "message": "Unable to clear tasks."
        });
        return;
      }
      res.status(200).json(result);
    } catch (err: unknown) {
      res.status(400).json({
        "message": "Unable to clear tasks."
      });
    }
  };

  router.post('/:user_id/new', validateAddTask, addTaskRoute);
  router.post('/:user_id/add-instructions', validateAddInstructions, addInstructionsRoute);
  router.delete('/:user_id/application/:application_id', validateClearTasks, clearTasksForApplicationRoute);
  router.put('/:task_id/complete', validateTaskIdParam, toggleTaskRoute);
  router.get('/:user_id', validateUserIdParam, getTasksRoute);
  return router;
};

export default taskController;