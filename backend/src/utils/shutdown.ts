/** Kept under the host's kill grace period (10s on most platforms) so we exit before being killed. */
export const SHUTDOWN_TIMEOUT_MS = 9000;

type ShutdownOptions = { timeoutMs?: number; exit?: (code: number) => void };

/**
 * Runs shutdown steps in order and exits 0, or exits 1 if a step throws or the whole
 * sequence outlasts the deadline, so a stuck request or job can't hold the process open.
 */
export const runShutdown = async (
  steps: Array<() => Promise<unknown>>,
  { timeoutMs = SHUTDOWN_TIMEOUT_MS, exit = process.exit }: ShutdownOptions = {}
) => {
  const deadline = setTimeout(() => {
    console.error(`[shutdown] did not drain within ${timeoutMs}ms, exiting`);
    exit(1);
  }, timeoutMs);
  deadline.unref();

  try {
    for (const step of steps) await step();
    clearTimeout(deadline);
    exit(0);
  } catch (error) {
    clearTimeout(deadline);
    console.error('[shutdown] failed:', error);
    exit(1);
  }
};

/** Runs the handler on the first SIGTERM or SIGINT; repeated signals are ignored. */
export const onShutdownSignal = (handler: (signal: NodeJS.Signals) => void) => {
  let started = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (started) return;
      started = true;
      handler(signal);
    });
  }
};
