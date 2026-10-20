import express, { type Request, type Response } from 'express';
import { listAgentRuns } from '../services/agentRun/agentRun.service.ts';
import { cancelAgent, runAgentNow } from '../agents/scheduler.ts';
import { validateRunIdParam } from './middleware/validators/agent.validate.ts';
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

    /** POST /me/agents/:run_id/run-now
     * start one of the caller's queued runs next, past their num_agents limit.
    **/
    const runNowRoute = async (req: Request<{ run_id: string }>, res: Response) => {
        const result = await runAgentNow(req.params.run_id, req.auth!.userId);
        res.status(202).json(result);
    };

    /** POST /me/agents/:run_id/cancel
     * cancel one of the caller's unfinished runs.
    **/
    const cancelRoute = async (req: Request<{ run_id: string }>, res: Response) => {
        const result = await cancelAgent(req.params.run_id, req.auth!.userId);
        res.status(200).json(result);
    };

    router.get('/', asyncHandler(listAgentsRoute));
    router.post('/:run_id/run-now', validateRunIdParam, asyncHandler(runNowRoute));
    router.post('/:run_id/cancel', validateRunIdParam, asyncHandler(cancelRoute));

    return router;
};
