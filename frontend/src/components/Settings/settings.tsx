import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchUserProfile, saveUserPreferences, setPreferences } from '../../store/userSlice'
import ComponentLoader from '../common/ComponentLoader'
import './settings.css'

export default function Settings() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((state) => state.user.profile)
  const status = useAppSelector((state) => state.user.status)
  const loadError = useAppSelector((state) => state.user.error)

  const waitForApproval = profile?.waitForApproval ?? false
  const recentJobs = profile?.recent_jobs ?? false
  const unpaidRoles = profile?.unpaid_roles ?? false
  const emailNotifications = profile?.email_notifications ?? true
  const sensitivity: 'L' | 'M' | 'H' =
    profile?.job_match === 'high' ? 'H' : profile?.job_match === 'low' ? 'L' : 'M'

  useEffect(() => {
    if (!profile && status === 'idle') {
      void dispatch(fetchUserProfile())
    }
  }, [dispatch, profile, status])

  const updatePrefs = (prefs: Partial<{ waitForApproval: boolean; recent_jobs: boolean; job_match: 'low' | 'medium' | 'high'; unpaid_roles: boolean; email_notifications: boolean }>) => {
    dispatch(setPreferences(prefs))
    void dispatch(saveUserPreferences(prefs))
  }

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

  const renderError = () => (
    <div className="settings-inner stagger-children">
      <h1 className="settings-title">settings</h1>
      <p className="prefs-subtitle" style={{ color: '#f87171', marginTop: '0.5rem' }}>
        {loadError || 'Failed to load preferences.'}{' '}
        <a className="settings-retry-btn" onClick={() => void dispatch(fetchUserProfile())}>
          retry
        </a>
      </p>
    </div>
  )

  const renderLoading = () => (
    <div className="settings-inner stagger-children">
      <h1 className="settings-title">settings</h1>
      <ComponentLoader label="loading preferences" />
    </div>
  )

  if (status === 'loading') {
    return <div className="settings-page page-stagger">{renderLoading()}</div>
  }

  if (status === 'failed') {
    return <div className="settings-page page-stagger">{renderError()}</div>
  }

  if (!profile) {
    return <div className="settings-page page-stagger">{renderLoading()}</div>
  }

  return (
    <div className="settings-page page-stagger">
      <div className="settings-inner stagger-children">
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
            {renderToggle(
              waitForApproval,
              () => {
                updatePrefs({ waitForApproval: !waitForApproval })
              },
              'wait for approval'
            )}
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">recent jobs</p>
              <p className="prefs-subtitle">apply only to jobs posted in the last week</p>
            </div>
            {renderToggle(
              recentJobs,
              () => {
                updatePrefs({ recent_jobs: !recentJobs })
              },
              'recent jobs'
            )}
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">unpaid roles</p>
              <p className="prefs-subtitle">allow applying to unpaid or volunteer positions</p>
            </div>
            {renderToggle(
              unpaidRoles,
              () => {
                updatePrefs({ unpaid_roles: !unpaidRoles })
              },
              'unpaid roles'
            )}
          </div>

          <div className="prefs-row">
            <div>
              <p className="prefs-label">email notifications</p>
              <p className="prefs-subtitle">receive status updates and alerts via email</p>
            </div>
            {renderToggle(
              emailNotifications,
              () => {
                updatePrefs({ email_notifications: !emailNotifications })
              },
              'email notifications'
            )}
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
                  onClick={() => {
                    updatePrefs({
                      job_match: level === 'H' ? 'high' : level === 'L' ? 'low' : 'medium',
                    })
                  }}
                  aria-pressed={sensitivity === level}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
