import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import './automation.css'
import { suppressErrorRedirect, releaseErrorRedirect } from '../../lib/fetchErrorControl'
import { getState, subscribe } from './automationStore'
import {
  approve,
  continueAfterHandoff,
  ensureGreeted,
  pause,
  refreshSearchTerms,
  resume,
  start,
} from './automationRun'

// A run holds its own key for as long as it lasts (see automationRun).
const SCREEN_SUPPRESSOR = 'automation-screen'

/**
 * A view of a run, not its owner -- status, logs, prompts and the loop itself live
 * in the automationRun singleton, so navigating away leaves the run untouched.
 */
export default function Automation() {
  const { status, logs, approvalPrompt, handoffPrompt, searchTermsReady } =
    useSyncExternalStore(subscribe, getState)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Screen-scoped: the search-term polling below logs to the console pane instead
  // of bouncing to /error.
  useEffect(() => {
    suppressErrorRedirect(SCREEN_SUPPRESSOR)
    return () => releaseErrorRedirect(SCREEN_SUPPRESSOR)
  }, [])

  useEffect(() => {
    ensureGreeted()
    refreshSearchTerms()
  }, [])

  // Until search terms exist, poll so the screen unlocks automatically once the
  // resume-enrichment worker finishes (a few seconds after onboarding submit).
  // Screen-scoped on purpose: a run already has the terms it started with.
  useEffect(() => {
    if (searchTermsReady === true) return
    const id = setInterval(() => { refreshSearchTerms(true) }, 4000)
    return () => clearInterval(id)
  }, [searchTermsReady])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const togglePanel = () => setIsPanelOpen(!isPanelOpen)

  return (
    <div className="automation-container">
      <div className="automation-header-row">
        {logs.length > 0 ? (
          <h1 className="automation-title">{logs[logs.length - 1].replace(/\[\d+:\d+:\d+ [AP]M\] /, '')}</h1>
        ) : (
          <h1 className="automation-title">automation</h1>
        )}
        <div className="header-controls">
          {status === 'running' ? (
            <button className="automation-pause-btn" title="Pause" onClick={pause}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          ) : status === 'paused' ? (
            <button className="automation-play-btn" title="Resume" onClick={resume}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ) : (
            <button
              className="automation-play-btn"
              title={searchTermsReady === true ? 'Play' : 'Preparing your job search…'}
              onClick={start}
              disabled={searchTermsReady !== true}
              style={searchTermsReady !== true ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          )}
          <button className="automation-menu-btn" title="Menu" onClick={togglePanel}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="16" x2="14" y2="16" />
            </svg>
          </button>
        </div>
      </div>
      {searchTermsReady !== true && (
        <div className="automation-loading-screen" role="status" aria-live="polite">
          <div className="automation-loading-spinner" aria-hidden="true" />
          <p className="automation-loading-title">
            {searchTermsReady === null
              ? 'checking your job search setup'
              : 'setting up your job search'}
          </p>
          <p className="automation-loading-detail">
            {searchTermsReady === null
              ? 'One moment…'
              : 'Analyzing your resume. Automation will unlock in a moment.'}
          </p>
        </div>
      )}
      {handoffPrompt && (
        <div className="handoff-banner" role="alert" aria-live="assertive">
          <div className="approval-text">
            <p className="approval-label">your help needed</p>
            <p className="approval-job">Page not recognized</p>
            <p className="approval-company">{handoffPrompt.reason}</p>
          </div>
          <button
            type="button"
            className="handoff-btn"
            onClick={continueAfterHandoff}
          >
            continue
          </button>
        </div>
      )}
      {approvalPrompt && (
        <div className="approval-banner" role="alert" aria-live="assertive">
          <div className="approval-text">
            <p className="approval-label">approval needed</p>
            <p className="approval-job">{approvalPrompt.jobTitle || 'Untitled job'}</p>
            <p className="approval-company">{approvalPrompt.company || 'Unknown company'}</p>
          </div>
          <div className="approval-actions">
            <button
              type="button"
              className="approval-btn approval-btn--yes"
              onClick={() => approve(true)}
              aria-label="Approve applying to this job"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <button
              type="button"
              className="approval-btn approval-btn--no"
              onClick={() => approve(false)}
              aria-label="Skip this job"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* The browser and its interaction blocker are <AutomationBrowser>, positioned
          over this screen's content box from above the route tree. */}
      <div className={`right-panel ${isPanelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <button className="panel-close-btn" onClick={togglePanel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="panel-content">
          <div className="console-logs">
            {logs.map((log, index) => (
              <div key={index} className="console-log-entry">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
