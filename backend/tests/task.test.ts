import request from 'supertest';
import { app } from '../app.ts';

jest.mock('../services/task.service.ts', () => ({
  addTask: jest.fn(),
  addInstructions: jest.fn(),
  clearTasksForApplication: jest.fn(),
  toggleTask: jest.fn(),
  getTasks: jest.fn(),
}));

jest.mock('../controller/middleware/requireUser.ts', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const USER_ID = 'test-user-id';
const TASK_ID = 'test-task-id';
const APP_ID = 'test-app-id';

describe('POST /tasks/:user_id/new', () => {
  it.todo('returns 200 and the created task on valid input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('POST /tasks/:user_id/add-instructions', () => {
  it.todo('returns 200 on valid input');
  it.todo('returns 400 when required body fields are missing');
  it.todo('returns 401 when user does not exist');
});

describe('DELETE /tasks/:user_id/application/:application_id', () => {
  it.todo('returns 200 and clears tasks for the application');
  it.todo('returns 401 when user does not exist');
});

describe('PUT /tasks/:task_id/complete', () => {
  it.todo('returns 200 and toggles the task completion status');
  it.todo('returns 400 when task_id is missing');
});

describe('GET /tasks/:user_id', () => {
  it.todo('returns 200 and list of tasks for the user');
  it.todo('returns 401 when user does not exist');
});

export { USER_ID, TASK_ID, APP_ID };
