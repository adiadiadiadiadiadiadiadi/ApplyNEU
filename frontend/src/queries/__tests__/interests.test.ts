import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { interestsMutationOptions, settingsKeys, type Preferences } from '../settings'

const put = vi.fn()
const get = vi.fn()
vi.mock('../../lib/api', () => ({ api: { put: (...args: unknown[]) => put(...args), get: (...args: unknown[]) => get(...args) } }))

const stored: Preferences = {
  wait_for_approval: true,
  recent_jobs: true,
  job_match: 'medium',
  unpaid_roles: false,
  email_notifications: true,
  interests: ['Robotics'],
}

const respond = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })

let queryClient: QueryClient
let server: Preferences

const save = (interests: string[]) =>
  new MutationObserver(queryClient, interestsMutationOptions(queryClient)).mutate(interests).catch(() => undefined)

const cachedInterests = () => queryClient.getQueryData<Preferences>(settingsKeys.preferences)?.interests

beforeEach(() => {
  put.mockReset()
  get.mockReset()
  server = { ...stored }
  get.mockImplementation(async () => respond(server))
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(settingsKeys.preferences, stored)
})

describe('interests mutation', () => {
  it('sends the full selection to /me/preferences/interests and shows it immediately', async () => {
    put.mockImplementation(async (_path: string, body: { interests: string[] }) => {
      server = { ...server, interests: body.interests }
      return respond({ interests: body.interests })
    })

    const pending = save(['Robotics', 'Fintech'])
    await vi.waitFor(() => expect(cachedInterests()).toEqual(['Robotics', 'Fintech']))
    await pending

    expect(put).toHaveBeenCalledWith('/me/preferences/interests', { interests: ['Robotics', 'Fintech'] })
  })

  it('restores the previous selection when the save fails', async () => {
    put.mockResolvedValue(respond({ message: 'boom' }, false))

    await save(['Robotics', 'Fintech'])

    expect(cachedInterests()).toEqual(['Robotics'])
  })

  it('applies rapid clicks in order so the last selection is what gets stored', async () => {
    const sent: string[][] = []
    put.mockImplementation(async (_path: string, body: { interests: string[] }) => {
      sent.push(body.interests)
      server = { ...server, interests: body.interests }
      return respond({ interests: body.interests })
    })

    await Promise.all([
      save(['Robotics', 'Fintech']),
      save(['Robotics', 'Fintech', 'Climate']),
      save(['Robotics', 'Climate']),
    ])

    expect(sent).toEqual([['Robotics', 'Fintech'], ['Robotics', 'Fintech', 'Climate'], ['Robotics', 'Climate']])
    await vi.waitFor(() => expect(cachedInterests()).toEqual(['Robotics', 'Climate']))
  })
})
