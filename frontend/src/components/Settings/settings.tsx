import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAppDispatch } from '../../store'
import { fetchUserProfile } from '../../store/userSlice'
import './settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const [waitForApproval, setWaitForApproval] = useState(false)
  const [repoToggle, setRepoToggle] = useState(false)
  const [jobMatchSensitivity, setJobMatchSensitivity] = useState<'L' | 'M' | 'H'>('M')
  const [branchPrefixToggle, setBranchPrefixToggle] = useState(false)
  const dispatch = useAppDispatch()

  useEffect(() => {
    void dispatch(fetchUserProfile())
  }, [dispatch])

  return (
    <div className="settings-blank">
      <h1 className="welcome-message">settings</h1>
      <div className="settings-actions">
        <button className="settings-action-button" onClick={() => navigate('/profile-settings')}>
          <span className="settings-action-button__line settings-action-button__line--primary">profile settings</span>
          <span className="settings-action-button__line settings-action-button__line--secondary">view and edit account details</span>
          <span className="settings-action-button__arrow">→</span>
        </button>
        <div className="settings-panel">
          <div className="settings-panel__header settings-panel__header--left">Preferences</div>
          <div className="settings-panel__rows">
            <div className="settings-panel__row">
              <div>
                <div className="settings-panel__title">wait for approval</div>
                <div className="settings-panel__subtitle">wait for user approval before applying to a job</div>
              </div>
              <button
                className={`settings-switch ${waitForApproval ? 'settings-switch--on' : ''}`}
                onClick={() => setWaitForApproval((prev) => !prev)}
              >
                <span className="settings-switch__thumb" />
              </button>
            </div>
            <div className="settings-panel__row">
              <div>
                <div className="settings-panel__title">recent jobs</div>
                <div className="settings-panel__subtitle">apply only to jobs posted in the last week</div>
              </div>
              <button
                className={`settings-switch ${repoToggle ? 'settings-switch--on' : ''}`}
                onClick={() => setRepoToggle((prev) => !prev)}
              >
                <span className="settings-switch__thumb" />
              </button>
            </div>
            <div className="settings-panel__row">
              <div>
                <div className="settings-panel__title">job match sensitivity</div>
                <div className="settings-panel__subtitle">how strict LLMs are when matching you to jobs</div>
              </div>
              <div className="settings-triple-toggle">
                {(['L', 'M', 'H'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`settings-triple-toggle__option ${
                      jobMatchSensitivity === level ? 'settings-triple-toggle__option--active' : ''
                    }`}
                    onClick={() => setJobMatchSensitivity(level)}
                    aria-pressed={jobMatchSensitivity === level}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-panel__row">
              <div>
                <div className="settings-panel__title">branch prefix</div>
                <div className="settings-panel__subtitle">toggle branch prefix usage</div>
              </div>
              <button
                className={`settings-switch ${branchPrefixToggle ? 'settings-switch--on' : ''}`}
                onClick={() => setBranchPrefixToggle((prev) => !prev)}
              >
                <span className="settings-switch__thumb" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
