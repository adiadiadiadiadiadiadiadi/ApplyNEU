import { getState } from './automationStore'

// Time-based control flow for a run. Everything here is pause-aware: a paused run
// stops advancing rather than racing ahead against a page the user is editing.

export const waitForResume = async () => {
  while (getState().status === 'paused') {
    await new Promise(res => setTimeout(res, 200))
  }
}

/** Sleeps in short chunks so a pause takes effect mid-wait, not only between steps. */
export const sleep = async (ms: number) => {
  let remaining = ms
  while (remaining > 0) {
    await waitForResume()
    const chunk = Math.min(remaining, 200)
    await new Promise(resolve => setTimeout(resolve, chunk))
    remaining -= chunk
  }
  await waitForResume()
}

/**
 * Polls `attempt` until it reports success. Returns false if it never does — which
 * callers are free to ignore, and several do. Use withHumanFallback instead wherever
 * continuing as though the step had worked would be wrong.
 */
export const retry = async (
  attempt: () => Promise<boolean>,
  { attempts = 40, interval = 100 }: { attempts?: number; interval?: number } = {}
): Promise<boolean> => {
  for (let i = 0; i < attempts; i++) {
    if (await attempt()) return true
    await sleep(interval)
  }
  return false
}
