import express, { type Request, type Response } from 'express';
import type { PostTaskRequest, PostInstructionsRequest } from '../types/tasks.ts';
import { addInstructions, addTask, toggleTask } from '../services/task.service.ts';

/**
 * This controller handles task-related routes.
 * 
 * @returns {express.Router} The router object containing the tasks routes.
 */
const taskController = () => {
  const router = express.Router();

  const addTaskRoute = async (req: PostTaskRequest, res: Response) => {
    const { user_id } = req.params;
    const { text, description } = req.body;

    if (!user_id || !text || !description) {
      res.status(404).json({
        "message": "Required arguments not found to post task."
      });
      return;
    }

    try {
      const task = await addTask(user_id, text, description);

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
    const { employer_instructions } = req.body;

    if (!user_id || !employer_instructions) {
      res.status(404).json({
        "message": "Required arguments not found to post task."
      });
      return;
    }

    try {
      const task = await addInstructions(user_id, employer_instructions);

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

  router.post('/:user_id/new', addTaskRoute);
  router.post('/:user_id/add-instructions', addInstructionsRoute)
  router.put('/:task_id/complete', toggleTaskRoute);
  return router;
};

export default taskController;