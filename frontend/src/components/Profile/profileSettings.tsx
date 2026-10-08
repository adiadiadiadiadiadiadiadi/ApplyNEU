import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfile, useUpdateProfile } from '../../queries/settings'
import ComponentLoader from '../common/ComponentLoader'
import './profile.css'

export default function ProfileSettings() {
  const navigate = useNavigate()
  const profileQuery = useProfile()
  const profile = profileQuery.data
  const saveFirstName = useUpdateProfile()
  const saveLastName = useUpdateProfile()
  const saveGradYear = useUpdateProfile()
  const [firstNameDraft, setFirstNameDraft] = useState<string | null>(null)
  const [lastNameDraft, setLastNameDraft] = useState<string | null>(null)
  const [gradYearDraft, setGradYearDraft] = useState<string | null>(null)
  const [gradYearError, setGradYearError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const savedFirstName = profile?.first_name ?? ''
  const savedLastName = profile?.last_name ?? ''
  const savedGradYear = profile ? String(profile.grad_year) : ''
  const firstName = firstNameDraft ?? savedFirstName
  const lastName = lastNameDraft ?? savedLastName
  const gradYear = gradYearDraft ?? savedGradYear

  // prevent page scroll while on profile settings
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const updateFirstName = () => {
    if (firstName === savedFirstName || saveFirstName.isPending) return
    saveFirstName.mutate({ first_name: firstName }, { onSuccess: () => setFirstNameDraft(null) })
  }

  const updateLastName = () => {
    if (lastName === savedLastName || saveLastName.isPending) return
    saveLastName.mutate({ last_name: lastName }, { onSuccess: () => setLastNameDraft(null) })
  }

  const updateGradYear = () => {
    if (gradYear === savedGradYear || saveGradYear.isPending) return
    const gradYearNumber = Number.parseInt(gradYear, 10)
    if (Number.isNaN(gradYearNumber)) {
      setGradYearError('Graduation year must be a number.')
      return
    }
    setGradYearError(null)
    saveGradYear.mutate({ grad_year: gradYearNumber }, { onSuccess: () => setGradYearDraft(null) })
  }

  const updatePassword = async () => {
    if (savingPassword) return
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Enter all password fields.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords must match.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }

    setSavingPassword(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setPasswordError('Could not load your account. Try again.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError('Current password is incorrect.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setPasswordError('Could not update password.')
        return
      }

      setPasswordSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Error updating password', err)
      setPasswordError('Unexpected error updating password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!profile) {
    if (profileQuery.isError) {
      return (
        <div className="profile-blank profile-loading">
          <span className="profile-subtext">could not load your profile.</span>
          <button
            type="button"
            className="profile-check-button"
            onClick={() => void profileQuery.refetch()}
          >
            retry
          </button>
        </div>
      )
    }
    return (
      <div className="profile-blank profile-loading">
        <ComponentLoader fullPage label="loading profile" />
      </div>
    )
  }

  return (
    <div className="profile-blank page-stagger">
      <div className="profile-content stagger-children">
        <div className="profile-header-row">
          <h1 className="welcome-message">
            <button
              type="button"
              className="profile-header-back"
              aria-label="Back to settings"
              onClick={() => navigate('/settings')}
            >
              ←
            </button>
            profile settings
          </h1>
        </div>
        <div className="profile-forms-row stagger-children">
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-first-name">first name</label>
            <div className="profile-input-row">
              <input
                id="profile-first-name"
                type="text"
                value={firstName}
                onChange={(event) => setFirstNameDraft(event.target.value)}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={updateFirstName}
                disabled={saveFirstName.isPending || firstName === savedFirstName}
              >
                ✓
              </button>
            </div>
            {saveFirstName.isError && <div className="profile-upload-error">Could not save first name.</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-last-name">last name</label>
            <div className="profile-input-row">
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(event) => setLastNameDraft(event.target.value)}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={updateLastName}
                disabled={saveLastName.isPending || lastName === savedLastName}
              >
                ✓
              </button>
            </div>
            {saveLastName.isError && <div className="profile-upload-error">Could not save last name.</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-current-password">current password</label>
            <div className="profile-input-row">
              <input
                id="profile-current-password"
                type="password"
                placeholder="current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-new-password">new password</label>
            <div className="profile-input-row profile-two-col">
              <input
                id="profile-new-password"
                type="password"
                className="profile-two-col__item"
                placeholder="new password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <input
                id="profile-confirm-password"
                type="password"
                className="profile-two-col__item"
                placeholder="confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updatePassword()}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                ✓
              </button>
            </div>
            {passwordError && <div className="profile-upload-error">{passwordError}</div>}
            {passwordSuccess && <div className="profile-success">{passwordSuccess}</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-grad-year">grad year</label>
            <div className="profile-input-row">
              <input
                id="profile-grad-year"
                type="text"
                value={gradYear}
                onChange={(event) => setGradYearDraft(event.target.value)}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={updateGradYear}
                disabled={saveGradYear.isPending || gradYear === savedGradYear}
              >
                ✓
              </button>
            </div>
            {(gradYearError || saveGradYear.isError) && (
              <div className="profile-upload-error">{gradYearError ?? 'Could not save grad year.'}</div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
