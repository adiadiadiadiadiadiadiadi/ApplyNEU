import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './profile.css'
import '../Onboarding/onboarding.css'

type LocationState = {
  interests?: string[]
}

export default function ProfileInterests() {
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state as LocationState) ?? {}
  const [userId, setUserId] = useState('')
  const [interests, setInterests] = useState<string[]>(locationState.interests ?? [])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return
      setUserId(user.id)

      if (!locationState.interests || locationState.interests.length === 0) {
        try {
          const resp = await fetch(`http://localhost:8080/resumes/${user.id}/possible-interests`)
          if (resp.ok) {
            const list = await resp.json()
            setInterests(list)
          }
        } catch (err) {
          console.error('Failed fetching interests', err)
        }
      }
    }

    void init()
  }, [locationState.interests])

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    )
  }

  const saveInterests = async () => {
    if (!userId || selectedInterests.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const saveResp = await fetch(`http://localhost:8080/users/${userId}/interests`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selectedInterests }),
      })
      if (!saveResp.ok) {
        throw new Error('Unable to save interests')
      }
      const searchResp = await fetch(`http://localhost:8080/users/${userId}/search-terms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!searchResp.ok) {
        throw new Error('Unable to update search terms')
      }
      navigate('/profile-settings')
    } catch (err) {
      console.error('Error saving interests', err)
      setError('Could not save interests. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <div className="onboarding-step">
          <h1 className="onboarding-title">select your interests</h1>
          <p className="onboarding-description">we'll use these to refresh your search terms.</p>
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
