import express, { type Request, type Response } from 'express';
import type { PostTaskRequest, PostInstructionsRequest } from '../types/tasks.ts';
import { addInstructions, addTask, toggleTask, getTasks, deleteTasksForApplication } from '../services/task.service.ts';

/**
 * This controller handles task-related routes.
 * 
 * @returns {express.Router} The router object containing the tasks routes.
 */
const taskController = () => {
  const router = express.Router();

  const addTaskRoute = async (req: PostTaskRequest, res: Response) => {
    const { user_id } = req.params;
    const { text, description, application_id } = req.body;

    if (!user_id || !text || !description) {
      res.status(404).json({
        "message": "Required arguments not found to post task."
      });
      return;
    }

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

  const addInstructionsRoute = async (req: PostInstructionsRequest, res: Response) => {
    const { user_id } = req.params;
    const { employer_instructions, application_id } = req.body;

    if (!user_id || !employer_instructions) {
      res.status(404).json({
        "message": "Required arguments not found to post task."
      });
      return;
    }

    try {
      const task = await addInstructions(user_id, employer_instructions, application_id);

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

  const toggleTaskRoute = async (req: Request, res: Response) => {
    const { task_id } = req.params;

    if (!task_id) {
      res.status(404).json({
        "message": "Missing arguments to toggle task completion."
      });
      return;
    }

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

  const getTasksRoute = async (req: Request, res: Response) => {
    const { user_id } = req.params;
    const includeCompleted = String(req.query?.includeCompleted ?? '').toLowerCase() === 'true';

    if (!user_id) {
      res.status(404).json({
        "message": "Missing arguments to get tasks."
      });
      return;
    }

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

  const clearTasksForApplicationRoute = async (req: Request, res: Response) => {
    const { user_id, application_id } = req.params;

    if (!user_id || !application_id) {
      res.status(404).json({
        "message": "Missing arguments to clear tasks."
      });
      return;
    }

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

  router.post('/:user_id/new', addTaskRoute);
  router.post('/:user_id/add-instructions', addInstructionsRoute)
  router.delete('/:user_id/application/:application_id', clearTasksForApplicationRoute)
  router.put('/:task_id/complete', toggleTaskRoute);
  router.get('/:user_id', getTasksRoute);
  return router;
};

export default taskController;