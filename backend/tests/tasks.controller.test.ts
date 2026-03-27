import express from 'express'
import request from 'supertest'

import taskController from '../controller/task.controller.ts'
import * as taskService from '../services/task.service.ts'

jest.mock('../services/task.service.ts')

const mockedGetTasks = jest.mocked(taskService.getTasks)

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/tasks', taskController())
  return app
}

describe('GET /tasks/:user_id', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns tasks including completed when includeCompleted=true', async () => {
    const sampleTasks = [
      { task_id: 't1', text: 'do thing', description: 'desc', completed: false },
      { task_id: 't2', text: 'done', description: 'desc2', completed: true },
    ]
    mockedGetTasks.mockResolvedValue(sampleTasks as any)

    const res = await request(buildApp()).get('/tasks/user-123?includeCompleted=true')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleTasks)
    expect(mockedGetTasks).toHaveBeenCalledWith('user-123', true)
  })

  it('defaults to only incomplete tasks when includeCompleted is missing', async () => {
    const sampleTasks = [{ task_id: 't3', text: 'only open', description: 'desc', completed: false }]
    mockedGetTasks.mockResolvedValue(sampleTasks as any)

    const res = await request(buildApp()).get('/tasks/user-abc')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(sampleTasks)
    expect(mockedGetTasks).toHaveBeenCalledWith('user-abc', false)
  })

  it('returns 404 when user_id is missing', async () => {
    const res = await request(buildApp()).get('/tasks/')

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'Missing arguments to get tasks.' })
  })
})
