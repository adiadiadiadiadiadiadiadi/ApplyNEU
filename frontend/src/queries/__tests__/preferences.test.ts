import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { preferencesMutationOptions, settingsKeys, type Preferences, type PreferenceChanges } from '../settings'

const put = vi.fn()
const get = vi.fn()
vi.mock('../../lib/api', () => ({ api: { put: (...args: unknown[]) => put(...args), get: (...args: unknown[]) => get(...args) } }))

const stored: Preferences = {
  wait_for_approval: true,
  recent_jobs: true,
  job_match: 'medium',
  unpaid_roles: false,
  email_notifications: true,
  interests: [],
}

const respond = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body })

const deferred = () => {
  let resolve!: (value: unknown) => void
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

let queryClient: QueryClient
let server: Preferences

const save = (changes: PreferenceChanges) =>
  new MutationObserver(queryClient, preferencesMutationOptions(queryClient)).mutate(changes).catch(() => undefined)

const cached = () => queryClient.getQueryData<Preferences>(settingsKeys.preferences)

beforeEach(() => {
  put.mockReset()
  get.mockReset()
  server = { ...stored }
  get.mockImplementation(async () => respond(server))
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  queryClient.setQueryData(settingsKeys.preferences, stored)
})

describe('preferences mutation', () => {
  it('shows the new value before the server answers', async () => {
    const reply = deferred()
    put.mockReturnValue(reply.promise)

    const pending = save({ recent_jobs: false })
    await vi.waitFor(() => expect(cached()?.recent_jobs).toBe(false))

    server = { ...server, recent_jobs: false }
    reply.resolve(respond(server))
    await pending
    expect(cached()?.recent_jobs).toBe(false)
  })

  it('rolls the toggle back when the save fails', async () => {
    put.mockResolvedValue(respond({ message: 'boom' }, false))

    await save({ unpaid_roles: true })

    expect(cached()?.unpaid_roles).toBe(false)
  })

  it('only rolls back the field that failed, keeping another pending change', async () => {
    const first = deferred()
    const second = deferred()
    put.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const failing = save({ unpaid_roles: true })
    const succeeding = save({ job_match: 'high' })
    await vi.waitFor(() => expect(cached()).toMatchObject({ unpaid_roles: true, job_match: 'high' }))

    first.resolve(respond({}, false))
    await failing
    expect(cached()).toMatchObject({ unpaid_roles: false, job_match: 'high' })

    server = { ...server, job_match: 'high' }
    second.resolve(respond(server))
    await succeeding
  })

  it('holds rapid clicks until the previous save finishes, so the last click wins', async () => {
    const slowFirst = deferred()
    const order: boolean[] = []
    put.mockImplementation((_path: string, body: PreferenceChanges) => {
      order.push(body.email_notifications!)
      server = { ...server, ...body }
      return order.length === 1 ? slowFirst.promise : Promise.resolve(respond(server))
    })

    const clicks = Promise.all([
      save({ email_notifications: false }),
      save({ email_notifications: true }),
      save({ email_notifications: false }),
    ])
    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(put).toHaveBeenCalledTimes(1)

    slowFirst.resolve(respond({ ...stored, email_notifications: false }))
    await clicks

    expect(order).toEqual([false, true, false])
    await vi.waitFor(() => expect(cached()?.email_notifications).toBe(false))
  })

  it('refetches once, after the last queued save settles', async () => {
    put.mockImplementation(async (_path: string, body: PreferenceChanges) => respond({ ...server, ...body }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await Promise.all([save({ recent_jobs: false }), save({ recent_jobs: true })])

    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
