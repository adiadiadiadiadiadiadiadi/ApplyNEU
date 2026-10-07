import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import './profile.css'
import '../Onboarding/onboarding.css'

export default function ProfileInterests() {
  const navigate = useNavigate()
  const [resumeId, setResumeId] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [interestsResp, preferencesResp, primaryResp] = await Promise.all([
          api.get('/interests'),
          api.get('/me/preferences'),
          api.get('/me/resumes/primary'),
        ])
        if (cancelled) return
        if (!interestsResp.ok) throw new Error('Unable to load interests')

        const options: string[] = await interestsResp.json()
        const stored: string[] = preferencesResp.ok ? ((await preferencesResp.json())?.interests ?? []) : []
        const primary = primaryResp.ok ? await primaryResp.json() : null
        if (cancelled) return

        setInterests(options)
        setSelectedInterests(stored.filter((interest) => options.includes(interest)))
        setResumeId(primary?.resume_id ?? '')
      } catch (err) {
        console.error('Error loading interests', err)
        if (!cancelled) setError('Could not load interests. Please try again.')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
  }

  const saveInterests = async () => {
    if (!resumeId || selectedInterests.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const saveResp = await api.put(`/resumes/${resumeId}/interests`, { interests: selectedInterests })
      if (!saveResp.ok) {
        throw new Error('Unable to save interests')
      }
      navigate('/settings')
    } catch (err) {
      console.error('Error saving interests', err)
      setError('Could not save interests. Please try again.')
    } finally {
      setLoading(false)
    }
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
            onClick={() => void saveInterests()}
            disabled={loading || selectedInterests.length === 0}
          >
            {loading ? 'saving...' : 'finish'}
          </button>
        </div>
      </div>
    </div>
  )
}
