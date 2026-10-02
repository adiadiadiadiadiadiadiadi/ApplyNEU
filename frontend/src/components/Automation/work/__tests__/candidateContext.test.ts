import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => 'user-1' }))
vi.mock('../../../../lib/api', () => {
  const json = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body, text: async () => '' })
  return {
    api: {
      get: vi.fn(async (path: string) => {
        if (path.includes('/me/context')) {
          if (contextStatus !== 200) return json({}, false, contextStatus)
          return json({
            resume: { resume_text: 'Backend engineer.', search_terms: ['software'] },
            preferences: { job_match: 'medium', wait_for_approval: false, job_types: ['Co-op'], unpaid_roles: true, recent_jobs: false, interests: [] },
            profile: { grad_year: 2027 },
          })
        }
        if (path.includes('/tasks')) return json([])
        return json({})
      }),
      post: vi.fn(async () => json({})),
      del: vi.fn(async () => json({})),
    },
  }
})

let contextStatus = 200

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  contextStatus = 200
})

const getPaths = (api: any): string[] => (api.get as any).mock.calls.map((c: any[]) => c[0] as string)

describe('the assembled profile replaces the startup fetches', () => {
  it('serves search terms and preferences from one /me/context call', async () => {
    const { api } = await import('../../../../lib/api')
    const { refreshSearchTerms } = await import('../searchTerms')
    const { loadUserPreferences, prefersRecentJobs, allowsUnpaidRoles } = await import('../preferences')
    const { getState } = await import('../automationStore')

    await refreshSearchTerms()
    const waitForApproval = await loadUserPreferences()

    expect(getState().searchTerms).toEqual(['software'])
    expect(waitForApproval).toBe(false)
    expect(prefersRecentJobs()).toBe(false)
    expect(allowsUnpaidRoles()).toBe(true)

    const paths = getPaths(api)
    expect(paths.filter(p => p.includes('/me/context'))).toHaveLength(1)
    expect(paths.some(p => p.includes('/resumes/primary') || p.includes('search-terms') || p.includes('/job-types'))).toBe(false)
  })

  it('refetches on a poll so enrichment that lands mid-run is picked up', async () => {
    const { api } = await import('../../../../lib/api')
    const { refreshSearchTerms } = await import('../searchTerms')

    await refreshSearchTerms()
    await refreshSearchTerms(true)

    expect(getPaths(api).filter(p => p.includes('/me/context'))).toHaveLength(2)
  })

  it('logs the no-resume message when the profile is not assembled yet', async () => {
    contextStatus = 404
    const { refreshSearchTerms } = await import('../searchTerms')
    const { getState } = await import('../automationStore')

    await refreshSearchTerms()

    expect(getState().logs.some(l => l.includes('No resume found'))).toBe(true)
  })
})
