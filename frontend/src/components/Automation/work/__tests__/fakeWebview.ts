import type { AutomationWebview } from '../automationWebview'

/**
 * The run loop only ever touches the page by handing it a snippet of JavaScript as
 * text and reading the answer -- 54 times, through executeJavaScript alone. So a
 * stand-in that answers those snippets from a script lets the whole loop run with no
 * Electron, no NUWorks and no sign-in.
 *
 * These are characterization tests: they pin what the loop *currently* does so a
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

  const view: FakeWebview = {
    src: url,
    calls,
    unmatched,
    hits,
    getURL: () => view.src,
    addEventListener: () => {},
    removeEventListener: () => {},
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

/** Substring of each script the loop injected, for readable call-order assertions. */
export const scriptTrace = (view: FakeWebview, marks: string[]) =>
  view.calls
    .map(code => marks.find(mark => code.includes(mark)))
    .filter((mark): mark is string => !!mark)
