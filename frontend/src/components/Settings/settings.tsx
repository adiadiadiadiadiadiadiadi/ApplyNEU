import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const [waitForApproval, setWaitForApproval] = useState(false)
  const [recentJobs, setRecentJobs] = useState(false)
  const [branchPrefix, setBranchPrefix] = useState(false)
  const [sensitivity, setSensitivity] = useState<'L' | 'M' | 'H'>('M')

  const toggleClass = (isOn: boolean) => (isOn ? 'toggle toggle--on' : 'toggle')

  const renderToggle = (value: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      aria-pressed={value}
      aria-label={label}
      className={toggleClass(value)}
      onClick={onToggle}
    >
      <span className="toggle__thumb" />
    </button>
  )

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <h1 className="settings-title">settings</h1>

        <div
          className="settings-card profile-card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/profile-settings')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/profile-settings')}
        >
          <div>
            <p className="profile-title">profile settings</p>
            <p className="profile-subtitle">view and edit account details</p>
          </div>
          <span className="profile-arrow" aria-hidden="true">
            →
          </span>
        </div>

        <div className="settings-card prefs-card">
          <p className="prefs-heading">Preferences</p>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">wait for approval</p>
              <p className="prefs-subtitle">wait for user approval before applying to a job</p>
            </div>
            {renderToggle(waitForApproval, () => setWaitForApproval(prev => !prev), 'wait for approval')}
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">recent jobs</p>
              <p className="prefs-subtitle">apply only to jobs posted in the last week</p>
            </div>
            {renderToggle(recentJobs, () => setRecentJobs(prev => !prev), 'recent jobs')}
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">job match sensitivity</p>
              <p className="prefs-subtitle">how strict LLMs are when matching you to jobs</p>
            </div>
            <div className="sensitivity-group" role="group" aria-label="job match sensitivity">
              {(['L', 'M', 'H'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  className={`sensitivity-btn ${sensitivity === level ? 'sensitivity-btn--active' : ''}`}
                  onClick={() => setSensitivity(level)}
                  aria-pressed={sensitivity === level}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">branch prefix</p>
              <p className="prefs-subtitle">toggle branch prefix usage</p>
            </div>
            {renderToggle(branchPrefix, () => setBranchPrefix(prev => !prev), 'branch prefix')}
          </div>
        </div>
      </div>
    </div>
  )
}
