import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInterestOptions, usePreferences, useSaveInterests } from '../../queries/settings'
import './profile.css'
import '../Onboarding/onboarding.css'

export default function ProfileInterests() {
  const navigate = useNavigate()
  const optionsQuery = useInterestOptions()
  const preferencesQuery = usePreferences()
  const saveInterests = useSaveInterests()
  const [selectionDraft, setSelectionDraft] = useState<string[] | null>(null)

  const interests = optionsQuery.data ?? []
  const storedInterests = (preferencesQuery.data?.interests ?? []).filter((interest) => interests.includes(interest))
  const selectedInterests = selectionDraft ?? storedInterests
  const loadFailed = optionsQuery.isError || preferencesQuery.isError
  const error = saveInterests.isError
    ? 'Could not save interests. Please try again.'
    : loadFailed
      ? 'Could not load interests. Please try again.'
      : null

  const toggleInterest = (interest: string) => {
    setSelectionDraft(
      selectedInterests.includes(interest)
        ? selectedInterests.filter((i) => i !== interest)
        : [...selectedInterests, interest],
    )
  }

  const submitInterests = () => {
    if (selectedInterests.length === 0) return
    saveInterests.mutate(selectedInterests, { onSuccess: () => navigate('/settings') })
  }

  return (
    <div className="onboarding-container page-stagger">
      <div className="onboarding-content stagger-children">
        <div className="onboarding-step">
          <h1 className="onboarding-title">select your interests</h1>
          <p className="onboarding-description">we'll use these to filter jobs for you.</p>
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
          {error && <div className="profile-upload-error">{error}</div>}
        </div>
        <div className="onboarding-actions">
          <button
            className="onboarding-button onboarding-button--primary"
            onClick={submitInterests}
            disabled={saveInterests.isPending || selectedInterests.length === 0}
          >
            {saveInterests.isPending ? 'saving...' : 'finish'}
          </button>
        </div>
      </div>
    </div>
  )
}
