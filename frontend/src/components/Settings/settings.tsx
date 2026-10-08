import { useNavigate } from 'react-router-dom'
import {
  usePreferences,
  usePrimaryResume,
  useUpdatePreferences,
  type JobMatch,
  type PreferenceChanges,
} from '../../queries/settings'
import ComponentLoader from '../common/ComponentLoader'
import './settings.css'

const SENSITIVITY_TO_JOB_MATCH: Record<'L' | 'M' | 'H', JobMatch> = { L: 'low', M: 'medium', H: 'high' }

export default function Settings() {
  const navigate = useNavigate()
  const preferencesQuery = usePreferences()
  const primaryResumeQuery = usePrimaryResume()
  const updatePreferences = useUpdatePreferences()

  const preferences = preferencesQuery.data
  const currentResumeName = primaryResumeQuery.data?.file_name ?? ''
  const interests = preferences?.interests ?? []

  const updatePrefs = (changes: PreferenceChanges) => {
    updatePreferences.mutate(changes)
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
        Failed to load preferences.{' '}
        <a className="settings-retry-btn" onClick={() => void preferencesQuery.refetch()}>
          retry
        </a>
      </p>
    </div>
  )

  const renderLoading = () => (
    <div className="settings-inner settings-inner--loading stagger-children">
      <h1 className="settings-title">settings</h1>
      <ComponentLoader fullPage label="loading preferences" />
    </div>
  )

  if (preferencesQuery.isError && !preferences) {
    return <div className="settings-page page-stagger">{renderError()}</div>
  }

  if (!preferences) {
    return <div className="settings-page page-stagger">{renderLoading()}</div>
  }

  const { wait_for_approval: waitForApproval, recent_jobs: recentJobs, unpaid_roles: unpaidRoles, email_notifications: emailNotifications } = preferences
  const sensitivity = preferences.job_match === 'high' ? 'H' : preferences.job_match === 'low' ? 'L' : 'M'

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

        <div
          className="settings-card profile-card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/settings/resumes')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/settings/resumes')}
        >
          <div>
            <p className="profile-title">primary resume</p>
            <p className="profile-subtitle">{currentResumeName || 'no resume uploaded yet'}</p>
          </div>
          <span className="profile-arrow" aria-hidden="true">
            →
          </span>
        </div>

        <div
          className="settings-card profile-card"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/settings/interests')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate('/settings/interests')}
        >
          <div>
            <p className="profile-title">interests</p>
            <p className="profile-subtitle">{interests.length ? interests.join(', ') : 'no interests selected yet'}</p>
          </div>
          <span className="profile-arrow" aria-hidden="true">
            →
          </span>
        </div>

        <div className="settings-card prefs-card">
          <p className="prefs-heading">Preferences</p>
          {updatePreferences.isError && (
            <p className="prefs-subtitle prefs-error" role="alert">
              couldn't save that change. please try again.
            </p>
          )}

          <div className="prefs-row">
            <div>
              <p className="prefs-label">wait for approval</p>
              <p className="prefs-subtitle">wait for user approval before applying to a job</p>
            </div>
            {renderToggle(
              waitForApproval,
              () => {
                updatePrefs({ wait_for_approval: !waitForApproval })
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
                    updatePrefs({ job_match: SENSITIVITY_TO_JOB_MATCH[level] })
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
