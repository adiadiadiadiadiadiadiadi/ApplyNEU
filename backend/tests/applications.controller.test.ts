import express from 'express'
import request from 'supertest'

import applicationController from '../controller/application.controller.ts'
import * as appService from '../services/application.service.ts'

jest.mock('../services/application.service.ts')

const mockedGetStats = jest.mocked(appService.getUserApplicationStats)
const mockedUpdateStatus = jest.mocked(appService.updateApplicationStatus)

const buildApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/applications', applicationController())
  return app
}

describe('applications routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns aggregate stats for a user', async () => {
    mockedGetStats.mockResolvedValue({
      total: 2,
      today: 1,
      week: 2,
      year: 2,
      applied: 1,
      interviews: 0,
      offers: 1,
      rejected: 0,
      pending: 0,
      external: 0,
    })

    const res = await request(buildApp()).get('/applications/user-55/stats')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ total: 2, offers: 1 })
    expect(mockedGetStats).toHaveBeenCalledWith('user-55')
  })

  it('updates application status', async () => {
    mockedUpdateStatus.mockResolvedValue({
      application_id: 'app-99',
      job_id: 'job-1',
      status: 'offer',
      applied_at: '2024-01-01T00:00:00Z',
    } as any)

    const res = await request(buildApp())
      .put('/applications/user-99/app-99/status')
      .send({ status: 'offer' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'offer', application_id: 'app-99' })
    expect(mockedUpdateStatus).toHaveBeenCalledWith('user-99', 'app-99', 'offer')
  })

  it('returns 404 when status is missing in request body', async () => {
    const res = await request(buildApp())
      .put('/applications/user-99/app-99/status')
      .send({})

    expect(res.status).toBe(404)
    expect(res.body).toEqual({ message: 'user_id, application_id, and status are required.' })
  })
})
