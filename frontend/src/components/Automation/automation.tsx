import { useState, useEffect } from 'react'
import './automation.css'

interface AutomationProps {
  onBack: () => void
}

export default function Automation({ onBack }: AutomationProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'error'>('idle')
  const [currentStep, setCurrentStep] = useState<string>('Initializing...')
  const [logs, setLogs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Add initial log
    addLog('Automation page loaded')
    addLog('Preparing to launch browser...')
    
    // Simulate starting automation
    setTimeout(() => {
      setStatus('running')
      setCurrentStep('Launching browser...')
      addLog('Browser launched successfully')
    }, 1000)

    // Setup webview event listeners
    const webview = document.querySelector('webview')
    if (webview) {
      const handleLoadStart = () => {
        addLog('Webview: Starting to load...')
      }
      
      const handleLoadStop = () => {
        addLog('Webview: Page loaded successfully')
      }
      
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

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const handleStart = () => {
    setStatus('running')
    setCurrentStep('Starting automation...')
    addLog('Starting automation process')
    // TODO: Trigger actual Playwright automation via IPC
  }

  const handlePause = () => {
    setStatus('paused')
    addLog('Automation paused by user')
  }

  const handleStop = () => {
    setStatus('idle')
    setCurrentStep('Stopped')
    addLog('Automation stopped by user')
  }

  return (
    <div className="automation-container">
      {/* Header */}
      <h1 className="automation-title">automation</h1>

      {/* Main Content */}
      <div className="automation-content">
        {/* Left Panel - Controls & Logs */}
        <div className="automation-sidebar">
          {/* Controls */}
          <div className="controls-card">
            <h2>Controls</h2>
            <div className="control-buttons">
              <button 
                onClick={handleStart} 
                className="control-btn control-btn--start"
                disabled={status === 'running'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Start
              </button>
              <button 
                onClick={handlePause} 
                className="control-btn control-btn--pause"
                disabled={status !== 'running'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
                Pause
              </button>
              <button 
                onClick={handleStop} 
                className="control-btn control-btn--stop"
                disabled={status === 'idle'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12"/>
                </svg>
                Stop
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="logs-card">
            <h2>Activity Log</h2>
            <div className="logs-container">
              {logs.map((log, index) => (
                <div key={index} className="log-entry">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Browser Display */}
        <div className="browser-display">
          <div className="browser-header">
            <div className="browser-controls">
              <span className="browser-dot browser-dot--red"></span>
              <span className="browser-dot browser-dot--yellow"></span>
              <span className="browser-dot browser-dot--green"></span>
            </div>
            <div className="browser-title">NUworks - Automated Job Application</div>
          </div>
          <div className="browser-content">
            {/* Embedded NUworks website using Electron webview */}
            <webview 
              src="https://northeastern-csm.symplicity.com/students/?signin_tab=0"
              className="browser-iframe"
              partition="persist:nuworks"
              allowpopups="true"
            ></webview>
          </div>
        </div>
      </div>
    </div>
  )
}

