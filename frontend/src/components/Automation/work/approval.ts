import { playAlertSound } from './automationHelpers'
import { addLog, getState, setState, setStatus } from './automationStore'

// The human-in-the-loop gates. Both are in-memory promise resolvers held here rather
// than by the screen, so a prompt raised while the user is on another route is still
// pending -- and still resolvable -- when they come back.
let approvalResolver: ((approved: boolean) => void) | null = null
let handoffResolver: (() => void) | null = null
let pausedByHandoff = false

export const requestApprovalForJob = (jobTitle: string, company: string) => {
  playAlertSound()
  return new Promise<boolean>((resolve) => {
    setState({ approvalPrompt: { jobTitle, company }, awaitingInput: true })
    setStatus('paused')
    approvalResolver = (approved: boolean) => {
      setState({ approvalPrompt: null, awaitingInput: false })
      setStatus('running')
      approvalResolver = null
      resolve(approved)
    }
  })
}

/**
 * Called when the applier can't find what it needs on the page. Pauses, drops the
 * interaction blocker so the user can drive the webview, and resolves once they say
 * they're done — at which point the caller retries the step it was stuck on.
 */
export const requestHumanHelp = (reason: string) => {
  playAlertSound()
  addLog(`Page not recognized; waiting for user... (${reason})`)
  return new Promise<void>((resolve) => {
    setState({ handoffPrompt: { reason }, awaitingInput: true })
    if (getState().status === 'running') {
      pausedByHandoff = true
      setStatus('paused')
    }
    handoffResolver = () => {
      setState({ handoffPrompt: null, awaitingInput: false })
      if (pausedByHandoff) {
        pausedByHandoff = false
        setStatus('running')
      }
      handoffResolver = null
      resolve()
    }
  })
}

/**
 * Runs `attempt` for up to timeoutMs. If it never succeeds, asks the user to sort the
 * page out and then tries again, indefinitely. Never gives up silently and never
 * continues as though the step had worked — the two failure modes that previously
 * produced bogus application records.
 */
export const withHumanFallback = async (
  reason: string,
  attempt: () => Promise<boolean>,
  timeoutMs = 5000
): Promise<void> => {
  for (;;) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await attempt()) return
      await new Promise(r => setTimeout(r, 100))
    }
    await requestHumanHelp(reason)
  }
}

export const approve = (approved: boolean) => {
  approvalResolver?.(approved)
}

export const continueAfterHandoff = () => {
  handoffResolver?.()
}
