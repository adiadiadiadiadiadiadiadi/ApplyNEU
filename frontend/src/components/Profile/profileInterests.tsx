import { useNavigate } from 'react-router-dom'
import { useInterestOptions, usePreferences, useSaveInterests } from '../../queries/settings'
import './profile.css'
import '../Onboarding/onboarding.css'
import '../Settings/settings.css'

export default function ProfileInterests() {
  const navigate = useNavigate()
  const optionsQuery = useInterestOptions()
  const preferencesQuery = usePreferences()
  const saveInterests = useSaveInterests()

  const interests = optionsQuery.data ?? []
  const selectedInterests = (preferencesQuery.data?.interests ?? []).filter((interest) => interests.includes(interest))
  const loadFailed = optionsQuery.isError || preferencesQuery.isError
  const error = saveInterests.isError
    ? 'Could not save interests. Please try again.'
    : loadFailed
      ? 'Could not load interests. Please try again.'
      : null

  // The API requires at least one interest, so the last selected one can't be cleared.
  const toggleInterest = (interest: string) => {
    const isSelected = selectedInterests.includes(interest)
    if (isSelected && selectedInterests.length === 1) return
    saveInterests.mutate(
      isSelected ? selectedInterests.filter((i) => i !== interest) : [...selectedInterests, interest],
    )
  }

  return (
    <div className="settings-page page-stagger">
      <div className="settings-inner profile-interests-inner stagger-children">
        <h1 className="settings-title">
          <button
            type="button"
            className="settings-back"
            aria-label="Back to settings"
            onClick={() => navigate('/settings')}
          >
            ←
          </button>
          interests
        </h1>
        <div className="interests-grid profile-interests-offset">
          {interests.map((interest) => (
            <span
              key={interest}
              className={`interest-tag ${selectedInterests.includes(interest) ? 'interest-tag--selected' : ''}`}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </span>
          ))}
        </div>
        {error && <p className="resume-error">{error}</p>}
      </div>
    </div>
  )
}
