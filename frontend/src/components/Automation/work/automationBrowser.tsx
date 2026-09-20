import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import '../automation.css'
import { HOME_URL, logNavigation } from './automationHelpers'
import { setAutomationWebview } from './automationWebview'
import type { AutomationWebview } from './automationWebview'
import { getState, subscribe } from './automationStore'

// Zoom level for the embedded NUWorks browser. Lower fits more of the page in the
// pane; below ~0.6 the job cards get too small for the selectors' scrollIntoView to
// land usefully.
const WEBVIEW_ZOOM_FACTOR = 0.8

const AUTOMATION_ROUTE = '/automation'

/**
 * The NUWorks browser surface, mounted once above the route tree so it never
 * unmounts. Inside the Automation route, leaving /automation destroyed the guest
 * WebContents and the signed-in session with it; here, leaving only hides it.
 */
export default function AutomationBrowser() {
  const hostRef = useRef<HTMLDivElement>(null)
  const state = useSyncExternalStore(subscribe, getState)
  const onAutomationRoute = useLocation().pathname === AUTOMATION_ROUTE

  useEffect(() => {
    const webview = hostRef.current?.querySelector('webview') as AutomationWebview | null
    if (!webview) return
    setAutomationWebview(webview)

    // Not surfaced to the user: the run loop retries, so a transient failure
    // shouldn't read as a hard stop.
    const handleLoadError = (event: any) => {
      console.warn('[automation] webview failed to load', event?.errorDescription)
    }
    webview.addEventListener('did-fail-load', handleLoadError)

    // Zoom out so more of the NUWorks page fits in the embedded pane. Reapplied on
    // every dom-ready because navigation can reset the factor.
    const applyZoom = () => {
      try {
        webview.setZoomFactor?.(WEBVIEW_ZOOM_FACTOR)
      } catch {
        // webview not attached yet; the next dom-ready will catch it
      }
    }
    webview.addEventListener('dom-ready', applyZoom)

    // The SSO redirect chain is the usual suspect when a run stalls on a login or
    // notice page, and it is invisible otherwise.
    const stopLoggingNavigation = logNavigation(webview, message =>
      console.debug('[automation]', message)
    )

    return () => {
      webview.removeEventListener('did-fail-load', handleLoadError)
      webview.removeEventListener('dom-ready', applyZoom)
      stopLoggingNavigation()
      setAutomationWebview(null)
    }
  }, [])

  const { awaitingInput, approvalPrompt, handoffPrompt } = state
  const showBlocker = (!awaitingInput || !!approvalPrompt) && !handoffPrompt

  return (
    <div
      ref={hostRef}
      className={`automation-browser-layer${onAutomationRoute ? '' : ' automation-browser-layer--hidden'}`}
    >
      <div className="browser-display">
        <div className="browser-content">
          <webview
            src={HOME_URL}
            className="browser-iframe"
            partition="persist:nuworks"
            allowpopups="true"
          ></webview>
        </div>
        {showBlocker && (
          <div className={`interaction-blocker${approvalPrompt ? ' interaction-blocker--transparent' : ''}`} />
        )}
      </div>
    </div>
  )
}
