import type { AutomationWebview } from '../automationWebview'

/**
 * Characterization tests: they pin what the loop *currently* does so a
 * refactor can be checked against it. The answers here are invented, so they say
 * nothing about whether the loop is correct against the real NUWorks.
 */
export type Answer = {
  /** Distinctive substring of the injected script, e.g. 'select[id*="transcript"]'. */
  match: string
  /** Value the page would return. A function receives the call index, for scripts
   *  whose answer changes as the loop makes progress. */
  result: unknown | ((callIndex: number) => unknown)
}

export type FakeWebview = AutomationWebview & {
  /** Every script the loop injected, in order. */
  calls: string[]
  /** Scripts that no answer matched -- a silent `undefined` is nearly always a bug
   *  in the scenario rather than intended behaviour. */
  unmatched: string[]
  /** Call count per answer, so a test can assert something was actually exercised. */
  hits: Map<string, number>
}

export const fakeWebview = (
  answers: Answer[],
  { url = 'https://northeastern-csm.symplicity.com/students/app/home' } = {}
): FakeWebview => {
  const calls: string[] = []
  const unmatched: string[] = []
  const hits = new Map<string, number>()

  const listeners = new Map<string, Set<(event: unknown) => void>>()
  const emit = (type: string) => {
    listeners.get(type)?.forEach(listener => listener({}))
  }

  // Assigning src is how the loop navigates, and waitForWebViewLoad waits on the
  // did-stop-loading that follows, so the setter has to emit it.
  let currentUrl = url

  const view: FakeWebview = {
    get src() { return currentUrl },
    set src(next: string) {
      currentUrl = next
      setTimeout(() => emit('did-stop-loading'), 0)
    },
    calls,
    unmatched,
    hits,
    getURL: () => currentUrl,
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener)
    },
    executeJavaScript: async (code: string) => {
      calls.push(code)
      const answer = answers.find(a => code.includes(a.match))
      if (!answer) {
        unmatched.push(code)
        return undefined
      }
      const index = hits.get(answer.match) ?? 0
      hits.set(answer.match, index + 1)
      return typeof answer.result === 'function'
        ? (answer.result as (i: number) => unknown)(index)
        : answer.result
    },
  }
  return view
}
