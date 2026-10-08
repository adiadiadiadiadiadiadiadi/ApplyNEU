import { beforeEach, describe, expect, it, vi } from 'vitest'

const analyzeReplies = vi.hoisted(() => ({ queue: [] as { status: number; retryAfter?: string }[] }))

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => 'user-1' }))
vi.mock('../../../../lib/api', () => {
  const json = (body: unknown) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => '' })
  return {
    api: {
      get: vi.fn(async (path: string) => {
        if (path.includes('/me/context')) return json({
          resume: { resume_text: 'Backend engineer.', search_terms: ['software', 'backend'] },
          preferences: { job_match: 'medium', wait_for_approval: false, job_types: ['Co-op'], unpaid_roles: false, recent_jobs: true, interests: [] },
          profile: { grad_year: 2027 },
        })
        if (path.includes('/tasks')) return json([])
        return json({})
      }),
      post: vi.fn(async (path: string) => {
        if (path.includes('/jobs/add')) return json({ job_id: 'j1' })
        if (path.includes('/jobs/analyze')) {
          const next = analyzeReplies.queue.shift()
          if (next) {
            return {
              ok: false,
              status: next.status,
              headers: new Headers(next.retryAfter === undefined ? {} : { 'Retry-After': next.retryAfter }),
              json: async () => ({ message: 'Too many requests.' }),
              text: async () => '',
            }
          }
          return json({ decision: 'APPLY', employer_instructions: [] })
        }
        if (path.includes('/applications')) return json({ application_id: 'a1' })
        return json({})
      }),
      del: vi.fn(async () => json({})),
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  analyzeReplies.queue = []
  ;(globalThis as any).AudioContext = class {
    currentTime = 0
    destination = {}
    createOscillator() { return { connect() {}, frequency: {}, type: '', start() {}, stop() {} } }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } } }
  }
})

const run = async () => {
  const { fakeWebview } = await import('./fakeWebview')
  const { reachesOneJob } = await import('./scenario')
  const { setAutomationWebview } = await import('../automationWebview')
  const { refreshSearchTerms } = await import('../searchTerms')
  const { start } = await import('../automationRun')
  const { getState } = await import('../automationStore')
  const { api } = await import('../../../../lib/api')

  const view = fakeWebview([
    { match: 'quicksearch-field', result: true },
    { match: 'hasLabel: !!label', result: { hasLabel: true, hasSelect: false, hasButton: true } },
    { match: 'button[id*="formfield"][id*="resume"]', result: true },
    { match: "'save') && !b.disabled && visible", result: true },
    { match: 'hasSelect: !!sel, hasButton', result: { hasSelect: false, hasButton: false } },
    ...reachesOneJob(),
  ])
  setAutomationWebview(view)
  await refreshSearchTerms()
  await start()

  const calls = (api.post as any).mock.calls as any[][]
  return {
    logs: getState().logs,
    status: getState().status,
    analyzed: calls.filter(c => c[0].includes('/jobs/analyze')).length,
    applications: calls.filter(c => c[0].includes('/applications')).length,
  }
}

describe('model call rate limit during a run', () => {
  it('stops the run with a clear message when the daily limit is hit', async () => {
    analyzeReplies.queue = [{ status: 429, retryAfter: '32400' }]

    const { logs, status, analyzed, applications } = await run()

    expect(analyzed).toBe(1)
    expect(applications).toBe(0)
    expect(status).toBe('idle')
    expect(logs.some(l => l.includes('Daily review limit reached. Stopping run. You can start again in about 9h.'))).toBe(true)
    expect(logs.some(l => l.includes('Decision request failed'))).toBe(false)
    expect(logs.some(l => l.includes('Completed running search terms.'))).toBe(false)
  })

  it('stops without calling it daily when a short limit keeps tripping', async () => {
    analyzeReplies.queue = [{ status: 429, retryAfter: '0' }, { status: 429, retryAfter: '0' }, { status: 429, retryAfter: '0' }]

    const { logs, analyzed, applications } = await run()

    expect(analyzed).toBe(3)
    expect(applications).toBe(0)
    expect(logs.some(l => l.includes('Review limit reached. Stopping run. You can start again in about 0s.'))).toBe(true)
    expect(logs.some(l => l.includes('Daily review limit'))).toBe(false)
  })

  it('waits out a short limit and retries the same job instead of skipping it', async () => {
    analyzeReplies.queue = [{ status: 429, retryAfter: '0' }]

    const { logs, analyzed, applications } = await run()

    expect(analyzed).toBe(2)
    expect(applications).toBeGreaterThan(0)
    expect(logs.some(l => l.includes('Rate limited. Waiting 0s before retrying...'))).toBe(true)
    expect(logs.some(l => l.includes('Decision request failed'))).toBe(false)
  })
})
