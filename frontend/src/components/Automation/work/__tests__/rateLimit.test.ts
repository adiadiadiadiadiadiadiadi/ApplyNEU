import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
const sleep = vi.fn(async (_ms: number) => {})
const addLog = vi.fn()

vi.mock('../../../../lib/api', () => ({ api: { post: (...args: unknown[]) => post(...args) } }))
vi.mock('../pacing', () => ({ sleep: (ms: number) => sleep(ms) }))
vi.mock('../automationStore', () => ({ addLog: (line: string) => addLog(line) }))

const { postWithRateLimit, retryAfterSeconds, formatWait } = await import('../rateLimit')

const response = (status: number, retryAfter?: string) =>
  ({ status, ok: status < 400, headers: new Headers(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }) }) as Response

beforeEach(() => {
  post.mockReset()
  sleep.mockClear()
  addLog.mockClear()
})

describe('postWithRateLimit', () => {
  it('returns a successful response without waiting', async () => {
    post.mockResolvedValueOnce(response(200))

    const resp = await postWithRateLimit('/me/jobs/analyze', { a: 1 })

    expect(resp.status).toBe(200)
    expect(post).toHaveBeenCalledWith('/me/jobs/analyze', { a: 1 })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('waits out a short Retry-After and retries the same request', async () => {
    post.mockResolvedValueOnce(response(429, '30')).mockResolvedValueOnce(response(200))

    const resp = await postWithRateLimit('/me/jobs/analyze', { a: 1 })

    expect(resp.status).toBe(200)
    expect(sleep).toHaveBeenCalledWith(30_000)
    expect(post).toHaveBeenCalledTimes(2)
    expect(addLog).toHaveBeenCalledWith('Rate limited. Waiting 30s before retrying...')
  })

  it('returns the 429 without waiting when Retry-After is too long to sit through', async () => {
    post.mockResolvedValueOnce(response(429, '32400'))

    const resp = await postWithRateLimit('/me/jobs/analyze', {})

    expect(resp.status).toBe(429)
    expect(sleep).not.toHaveBeenCalled()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('gives up after three attempts if the limit keeps tripping', async () => {
    post.mockResolvedValue(response(429, '5'))

    const resp = await postWithRateLimit('/me/jobs/analyze', {})

    expect(resp.status).toBe(429)
    expect(post).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('passes non-429 errors straight through', async () => {
    post.mockResolvedValueOnce(response(500))

    expect((await postWithRateLimit('/me/jobs/analyze', {})).status).toBe(500)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe('retryAfterSeconds', () => {
  it('reads the header in seconds', () => {
    expect(retryAfterSeconds(response(429, '38'))).toBe(38)
  })

  it('falls back to a minute when the header is missing or unreadable', () => {
    expect(retryAfterSeconds(response(429))).toBe(60)
    expect(retryAfterSeconds(response(429, 'soon'))).toBe(60)
  })
})

describe('formatWait', () => {
  it('rounds up to the largest sensible unit', () => {
    expect(formatWait(45)).toBe('45s')
    expect(formatWait(61)).toBe('2m')
    expect(formatWait(32_400)).toBe('9h')
  })
})
