import { useState, useEffect, useRef } from 'react'
import './automation.css'
import { navigateLogin, playAlertSound, waitForLoginButton } from './automationHelpers'

export default function Automation() {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const isPausedRef = useRef(false)
  const automationStepRef = useRef<number>(0)

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      addLog('Automation page loaded')
      addLog('Ready to start automation')
    }

    const webview = document.querySelector('webview')
    if (webview) {
      const handleLoadStart = () => addLog('Webview: Starting to load...')
      const handleLoadStop = () => addLog('Webview: Page loaded successfully')
      const handleLoadError = (event: any) => {
        addLog(`Webview Error: ${event.errorDescription || 'Failed to load'}`)
        console.error('Webview load error:', event)
      }

      webview.addEventListener('did-start-loading', handleLoadStart)
      webview.addEventListener('did-stop-loading', handleLoadStop)
      webview.addEventListener('did-fail-load', handleLoadError)

      return () => {
        webview.removeEventListener('did-start-loading', handleLoadStart)
        webview.removeEventListener('did-stop-loading', handleLoadStop)
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

  // Helper to wait while respecting pause state
  const waitWithPauseCheck = async (ms: number): Promise<void> => {
    const startTime = Date.now()
    return new Promise((resolve) => {
      const check = () => {
        if (isPausedRef.current) {
          // Paused - keep checking every 100ms
          setTimeout(check, 100)
        } else {
          const elapsed = Date.now() - startTime
          if (elapsed >= ms) {
            resolve()
          } else {
            // Continue waiting
            setTimeout(check, 100)
          }
        }
      }
      check()
    })
  }

  const runAutomation = async () => {
    const webview = document.querySelector('webview') as any
    if (!webview) {
      addLog('Error: Webview not found')
      setStatus('error')
      return
    }

    try {
      // Step 1: Click login button
      if (automationStepRef.current === 0) {
        addLog('Step 1: Clicking login button...')
        const result = await navigateLogin(webview)
        addLog(result.message)
        
        if (!result.success) {
          setStatus('error')
          return
        }
        
        automationStepRef.current = 1
      }

      await waitWithPauseCheck(1500)

      if (automationStepRef.current === 1) {
        playAlertSound()
        addLog('ALERT: Login page reached - User input needed')
        automationStepRef.current = 2
      }
      addLog('Automation sequence completed')
      setStatus('idle')
      automationStepRef.current = 0
      
    } catch (error: any) {
      addLog(`Error: ${error.message}`)
      setStatus('error')
      automationStepRef.current = 0
    }
  }

  const handlePlayClick = async () => {
    setStatus('running')
    isPausedRef.current = false
    
    // Reset to start page
    const webview = document.querySelector('webview') as any
    if (webview) {
      webview.src = 'https://northeastern-csm.symplicity.com/students/?signin_tab=0'
      addLog('Resetting to start page...')
      
      // Wait for page to load by checking for the button
      const loadResult = await waitForLoginButton(webview)
      addLog(loadResult.message)
      
      if (loadResult.success) {
        addLog('Starting automation...')
        runAutomation()
      } else {
        addLog('Error: Could not start automation')
        setStatus('error')
      }
    } else {
      addLog('Error: Webview not found')
      setStatus('error')
    }
  }

  const handlePause = () => {
    isPausedRef.current = true
    setStatus('paused')
    addLog('Automation paused - Will resume from current step')
  }

  const handleResume = () => {
    isPausedRef.current = false
    setStatus('running')
    addLog(`Automation resumed from step ${automationStepRef.current + 1}`)
    runAutomation()
  }

  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen)
  }

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
              <line x1="4" y1="8" x2="20" y2="8"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="16" x2="14" y2="16"/>
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
