import { useState, useEffect, useRef } from 'react'
import './automation.css'
import { waitForSelector, waitForLegend, waitForSearchBar, playAlertSound } from './automationHelpers'
import { getUserId } from '../../lib/supabase'

export default function Automation() {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const fetchSearchTerms = async () => {
      try {
        const userId = await getUserId()
        if (!userId) {
          addLog('Error occured: no user found.')
          return
        }

        const response = await fetch(`http://localhost:8080/users/${userId}/search-terms`)
        if (!response.ok) {
          addLog('Error occured.')
          return
        }

        const data = await response.json()
        const terms = Array.isArray(data?.search_terms) ? data.search_terms : []
        setSearchTerms(terms)
      } catch (error) {
        addLog('Error occured.')
      }
    }

    fetchSearchTerms()

    if (!initializedRef.current) {
      initializedRef.current = true
      addLog("Bot connected...")
    }
    const webview = document.querySelector('webview')
    if (webview) {
      const handleLoadError = (event: any) => {
        addLog(`Error: ${event.errorDescription || 'failed to load'}`)
      }
      webview.addEventListener('did-fail-load', handleLoadError)
      return () => {
        webview.removeEventListener('did-fail-load', handleLoadError)
      }
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const handlePlayClick = async () => {
    setStatus('running')
    addLog('Beginning automation...')
    const webview = document.querySelector('webview') as any
    if (!webview) {
      addLog('Error: Webview not found')
      setStatus('error')
      return
    }
    webview.src = 'https://northeastern-csm.symplicity.com/students/?signin_tab=0'

    const dashboardLoaded = await webview.executeJavaScript("!!document.querySelector('input#quicksearch-field')")
    if (dashboardLoaded) {
      await handleAutomationFromDashboard(webview)
      return
    }

    await waitForSelector(webview, 'input.input-button.btn.btn_primary.full_width.btn_multi_line')
    await webview.executeJavaScript(`document.querySelector('input.input-button.btn.btn_primary.full_width.btn_multi_line').click()`)
    addLog('Navigating to login...')

    await waitForLegend(webview, 'Login to Shibboleth')
    addLog('Waiting for user input...')
    playAlertSound()
    addLog('Waiting for user input...')
    await waitForSearchBar(webview)

    addLog('Continuing...')
    await handleAutomationFromDashboard(webview)
  }

  const handleAutomationFromDashboard = async (webview: any) => {
    await waitForSearchBar(webview)

    if (!searchTerms.length) {
      addLog('No search terms available to search.')
      setStatus('idle')
      return
    }

    addLog(`Running ${searchTerms.length} search terms...`)
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    for (const term of searchTerms) {
      addLog(`Searching for "${term}"...`)
      const success = await webview.executeJavaScript(`
        (() => {
          const input = document.querySelector('input#quicksearch-field');
          if (!input) return false;
          input.focus();
          input.value = ${JSON.stringify(term)};
          input.dispatchEvent(new InputEvent('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));

          const form = input.closest('form');
          if (form && typeof form.requestSubmit === 'function') {
            form.requestSubmit();
            return true;
          }

          const submitBtn = (form && form.querySelector('button[type="submit"], input[type="submit"]')) || document.querySelector('button[type="submit"], input[type="submit"]');
          if (submitBtn) {
            submitBtn.click();
            return true;
          }

          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
          return true;
        })();
      `)

      if (!success) {
        addLog(`Failed to trigger search for "${term}".`)
        continue
      }

      await sleep(1500)

      let opened = false
      for (let attempt = 0; attempt < 10; attempt++) {
        const result = await webview.executeJavaScript(`
          (() => {
            const nodes = Array.from(document.querySelectorAll('a.link-primary, a, button, div[role="button"]'));
            const target = nodes.find(el => (el.textContent || '').trim().toLowerCase() === 'see all job results');
            if (!target) return 'missing';
            target.scrollIntoView({ behavior: 'instant', block: 'center' });
            target.click();
            return 'clicked';
          })();
        `)

        if (result === 'clicked') {
          opened = true
          break
        }
        await sleep(500)
      }

      if (opened) {
        addLog(`Opened results for "${term}".`)
      } else {
        addLog(`Could not find "See all job results" for "${term}".`)
      }

      await sleep(2000)
    }

    addLog('Completed running search terms.')

    setStatus('idle')
  }

  const handlePause = () => setStatus('paused')
  const handleResume = () => {
    setStatus('running')
    // Continue from next step here if you add further automation
  }
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
            <button className="automation-pause-btn" title="Pause" onClick={handlePause}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          ) : status === 'paused' ? (
            <button className="automation-play-btn" title="Resume" onClick={handleResume}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ) : (
            <button className="automation-play-btn" title="Play" onClick={handlePlayClick}>
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
      <div className="automation-content">
        <div className="browser-display">
          <div className="browser-content">
            <webview
              src="https://northeastern-csm.symplicity.com/students/?signin_tab=0"
              className="browser-iframe"
              partition="persist:nuworks"
              allowpopups="true"
            ></webview>
          </div>
        </div>
      </div>
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