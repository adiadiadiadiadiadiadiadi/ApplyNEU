import express, { type Request, type Response } from 'express';
import { listAgentRuns } from '../services/agentRun/agentRun.service.ts';
import asyncHandler from './middleware/handlers/asyncHandler.ts';

export const meAgentController = (): express.Router => {
    const router = express.Router();

    /** GET /me/agents
     * return the caller's agent runs grouped for the homepage: needs_you, running, queued, recent.
    **/
    const listAgentsRoute = async (req: Request, res: Response) => {
        const result = await listAgentRuns(req.auth!.userId);
        res.status(200).json(result);
    };

    router.get('/', asyncHandler(listAgentsRoute));

    return router;
};
