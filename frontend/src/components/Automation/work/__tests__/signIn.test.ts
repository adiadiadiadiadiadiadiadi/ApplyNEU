import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Answer } from './fakeWebview'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => 'user-1' }))
vi.mock('../../../../lib/api', () => {
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' })
  return {
    api: {
      get: vi.fn(async (path: string) => {
        if (path.includes('/job-types')) return json({ job_types: ['Co-op'] })
        if (path.includes('/preferences/')) return json({ wait_for_approval: false, recent_jobs: true, unpaid_roles: false })
        if (path.includes('/tasks/')) return json([])
        if (path.includes('/latest')) return json({ resume_id: 'r1' })
        if (path.includes('search-terms')) return json({ search_terms: ['software'] })
        return json({})
      }),
      post: vi.fn(async (path: string) => {
        if (path.includes('/jobs/add')) return json({ job_id: 'j1' })
        if (path.includes('/jobs/analyze')) return json({ decision: 'DO_NOT_APPLY' })
        return json({})
      }),
      del: vi.fn(async () => json({})),
    },
  }
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  ;(globalThis as any).AudioContext = class {
    currentTime = 0
    destination = {}
    createOscillator() { return { connect() {}, frequency: {}, type: '', start() {}, stop() {} } }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } } }
  }
})

/** Not signed in yet; the dashboard appears only after `after` isHome checks. */
const signedInAfter = (after: number): Answer[] => [
  { match: 'quicksearch-field', result: (i: number) => i >= after },
  { match: 'input-button', result: true },
  { match: 'btn_multi_line', result: true },
]

const run = async (extra: Answer[]) => {
  const { fakeWebview } = await import('./fakeWebview')
  const { reachesOneJob } = await import('./scenario')
  const { setAutomationWebview } = await import('../automationWebview')
  const { refreshSearchTerms } = await import('../searchTerms')
  const { start } = await import('../automationRun')
  const { getState } = await import('../automationStore')

  const view = fakeWebview([...extra, ...reachesOneJob()])
  setAutomationWebview(view)
  await refreshSearchTerms()
  await start()

  return { view, logs: getState().logs.map(l => l.replace(/^\[.*?\] /, '')) }
}

describe('sign-in handoff', () => {
  it('does not ask the user when SSO completes on its own', async () => {
    const { logs } = await run(signedInAfter(3))

    expect(logs).not.toContain('Waiting for user to sign in...')
    expect(logs).toContain('Continuing...')
  }, 20000)

  it('asks the user once the grace period passes without reaching the dashboard', async () => {
    const { logs } = await run(signedInAfter(30))

    expect(logs).toContain('Waiting for user to sign in...')
    expect(logs).toContain('Continuing...')
  }, 30000)
})
