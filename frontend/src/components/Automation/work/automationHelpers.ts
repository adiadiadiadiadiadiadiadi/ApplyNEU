export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Polls for a selector. Unbounded by default; pass timeoutMs to get a false return
 * instead of spinning forever when the page isn't what we expected.
 */
export const waitForSelector = async (webview: any, selector: string, timeoutMs?: number): Promise<boolean> => {
  const deadline = timeoutMs === undefined ? Infinity : Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const found = await webview.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return true;
    await sleep(200);
  }
  return false
}

export const NUWORKS_ORIGIN = 'https://northeastern-csm.symplicity.com'
export const HOME_URL = `${NUWORKS_ORIGIN}/students/app/home`

/**
 * True when the webview has left NUWorks for the identity provider. Northeastern SSO
 * spans several hosts and has moved between Shibboleth and Entra, so this asserts
 * only "not NUWorks" rather than trying to enumerate them.
 */
export const isInAuthFlow = (url: string) => !!url && !url.startsWith(NUWORKS_ORIGIN)

/** The webview's current URL, or '' if the guest isn't attached yet. */
export const currentUrl = (webview: any): string => {
  try {
    return webview.getURL?.() ?? ''
  } catch {
    return ''
  }
}

/**
 * True when the webview is sitting on the authenticated NUWorks dashboard.
 *
 * Checks the URL first, then the dashboard's quick-search box. Either signal alone
 * can lie: Symplicity can keep us under /students/app/ while showing an SSO
 * interstitial, and the selector can match on a stale page mid-navigation. Requiring
 * both means a change to either one degrades to "not home" (so we wait or ask the
 * user) rather than a false positive that sends the job loop off a cliff.
 */
export const isHome = async (webview: any): Promise<boolean> => {
  let url: string
  try {
    url = webview.getURL?.() ?? ''
  } catch {
    return false
  }
  if (!url.startsWith(HOME_URL) && !url.includes('/students/app/')) return false
  if (url.includes('signin')) return false
  return webview.executeJavaScript(`!!document.querySelector('input#quicksearch-field')`)
}

/**
 * Polls until the webview reaches the dashboard. Unbounded by default, matching the
 * previous waitForSearchBar behaviour; pass timeoutMs to get a false return instead
 * of waiting forever.
 */
export const waitForHome = async (webview: any, timeoutMs?: number): Promise<boolean> => {
  const deadline = timeoutMs === undefined ? Infinity : Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isHome(webview)) return true
    await sleep(200)
  }
  return false
}

/** Logs every URL the webview lands on, so a NUWorks navigation change is visible. */
export const logNavigation = (webview: any, log: (message: string) => void) => {
  const handler = (event: any) => log(`Navigated: ${event?.url ?? webview.getURL?.() ?? 'unknown'}`)
  webview.addEventListener('did-navigate', handler)
  webview.addEventListener('did-navigate-in-page', handler)
  return () => {
    webview.removeEventListener('did-navigate', handler)
    webview.removeEventListener('did-navigate-in-page', handler)
  }
}

export const playAlertSound = () => {
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.frequency.value = 800
  oscillator.type = 'sine'
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
}

export const waitForWebViewLoad = (webview: any, timeoutMs = 30000): Promise<void> => {
  return new Promise(resolve => {
    // Assigning src does not always start a navigation (same URL, or a guest that
    // is not attached yet), in which case did-stop-loading never fires and the whole
    // run would block here.
    const timer = setTimeout(() => { done() }, timeoutMs)
    const done = () => {
      clearTimeout(timer)
      webview.removeEventListener('did-stop-loading', done)
      resolve()
    }
    webview.addEventListener('did-stop-loading', done)
  })
}

export const cleanTitle = (title: string | undefined) => {
  if (!title) return ''
  const atSplit = title.split(' @ ')[0] || title
  return atSplit.trim()
}

export const withTitleSuffix = (title: string | undefined, text: string) => {
  const cleaned = cleanTitle(title)
  return cleaned ? `${text} (${cleaned})` : text
}

export const toBool = (value: unknown, fallback = true) =>
  value === undefined || value === null ? fallback : value === true || value === 'true'

export const buildTaskKey = (text: string, applicationId?: string | null) =>
  `${applicationId ?? 'global'}::${text.trim().toLowerCase()}`

export type EmployerInstruction = { text: string; description: string }

export const normalizeEmployerInstructions = (input: any): EmployerInstruction[] => {
  if (!input) return []
  const arr = Array.isArray(input) ? input : [input]
  return arr
    .map((item: any) => {
      if (item && typeof item === 'object') {
        const text = String(item.instruction ?? item.text ?? item.title ?? '').trim()
        const description = String(item.description ?? item.detail ?? item.text ?? item.instruction ?? '').trim()
        const finalText = text || description
        const finalDesc = description || text
        if (!finalText) return null
        return { text: finalText, description: finalDesc }
      }
      const asString = String(item ?? '').trim()
      if (!asString) return null
      return { text: asString, description: asString }
    })
    .filter((v: EmployerInstruction | null): v is EmployerInstruction => !!v)
}
