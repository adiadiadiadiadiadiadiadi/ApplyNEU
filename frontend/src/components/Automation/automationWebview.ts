// AutomationBrowser registers the <webview> here once; the run loop reads it back
// instead of re-running document.querySelector on every step.

/** Electron's webview tag, narrowed to what the run loop actually uses. */
export type AutomationWebview = {
  src: string
  executeJavaScript: (code: string) => Promise<any>
  getURL: () => string
  setZoomFactor?: (factor: number) => void
  addEventListener: (type: string, listener: (event: any) => void) => void
  removeEventListener: (type: string, listener: (event: any) => void) => void
}

let webview: AutomationWebview | null = null

export const setAutomationWebview = (el: AutomationWebview | null) => {
  webview = el
}

export const getAutomationWebview = () => webview
