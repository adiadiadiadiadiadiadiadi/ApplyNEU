import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { api } from '../../lib/api'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchUserProfile, setProfileDetails } from '../../store/userSlice'
import './profile.css'

export default function ProfileSettings() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const cachedProfile = useAppSelector((state) => state.user.profile)
  const status = useAppSelector((state) => state.user.status)
  const userId = cachedProfile?.id ?? ''
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [savedFirstName, setSavedFirstName] = useState('')
  const [savedLastName, setSavedLastName] = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [savedGradYear, setSavedGradYear] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingGrad, setSavingGrad] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [currentResumeName, setCurrentResumeName] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!cachedProfile && status === 'idle') {
      void dispatch(fetchUserProfile())
    }
  }, [dispatch, cachedProfile, status])

  // Seed the inputs from the cached profile once. Later cache updates are
  // echoes of this page's own saves, and re-seeding would clobber live edits.
  const seeded = useRef(false)
  useEffect(() => {
    if (!cachedProfile || seeded.current) return
    seeded.current = true
    setFirstName(cachedProfile.firstName)
    setLastName(cachedProfile.lastName)
    setEmail(cachedProfile.email)
    setGradYear(cachedProfile.gradYear)
    setSavedFirstName(cachedProfile.firstName)
    setSavedLastName(cachedProfile.lastName)
    setSavedEmail(cachedProfile.email)
    setSavedGradYear(cachedProfile.gradYear)
  }, [cachedProfile])

  useEffect(() => {
    let cancelled = false
    const loadLatestResume = async () => {
      try {
        const resp = await api.get('/me/resumes/latest')
        if (cancelled || !resp.ok) return
        const latest = await resp.json()
        setCurrentResumeName((latest.file_name ?? '').toString())
      } catch (err) {
        console.error('Failed fetching latest resume', err)
      }
    }

    void loadLatestResume()
    return () => {
      cancelled = true
    }
  }, [])

  // prevent page scroll while on profile settings
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const saveProfile = async ({
    nextFirst,
    nextLast,
    nextEmail,
    nextGradYear,
    onFinally,
  }: {
    nextFirst?: string
    nextLast?: string
    nextEmail?: string
    nextGradYear?: string
    onFinally: () => void
  }) => {
    if (!userId) {
      onFinally()
      return
    }

    const finalFirst = nextFirst ?? firstName
    const finalLast = nextLast ?? lastName
    const finalEmail = (nextEmail ?? email).trim()
    const finalGradYear = nextGradYear ?? gradYear
    const gradYearNumber = Number.parseInt(finalGradYear, 10)

    if (Number.isNaN(gradYearNumber)) {
      console.error('Graduation year must be a number')
      onFinally()
      return
    }

    try {
      const resp = await api.put('/me', {
        first_name: finalFirst,
        last_name: finalLast,
        email: finalEmail,
        grad_year: gradYearNumber,
      })

      if (!resp.ok) {
        console.error('Failed updating user in postgres')
        return
      }

      const updated = await resp.json()
      const nextDetails = {
        firstName: (updated.first_name ?? finalFirst).toString(),
        lastName: (updated.last_name ?? finalLast).toString(),
        email: (updated.email ?? finalEmail).toString(),
        gradYear: (updated.grad_year ?? gradYearNumber).toString(),
      }
      setFirstName(nextDetails.firstName)
      setLastName(nextDetails.lastName)
      setEmail(nextDetails.email)
      setGradYear(nextDetails.gradYear)
      setSavedFirstName(nextDetails.firstName)
      setSavedLastName(nextDetails.lastName)
      setSavedEmail(nextDetails.email)
      setSavedGradYear(nextDetails.gradYear)
      dispatch(setProfileDetails(nextDetails))
    } catch (err) {
      console.error('Error updating user in postgres', err)
    } finally {
      onFinally()
    }
  }

  const updateName = async (part: 'first' | 'last', value: string) => {
    if ((part === 'first' && value === savedFirstName) || (part === 'last' && value === savedLastName)) {
      return
    }
    if (savingName) return
    setSavingName(true)
    const nextFirst = part === 'first' ? value : undefined
    const nextLast = part === 'last' ? value : undefined
    await saveProfile({
      nextFirst,
      nextLast,
      onFinally: () => setSavingName(false),
    })
  }

  const updateEmail = async () => {
    setEmailError(null)
    if (email.toLowerCase().endsWith('@northeastern.edu')) {
      setEmailError('northeastern.edu emails are not allowed.')
      return
    }
    if (email === savedEmail) return
    if (savingEmail) return
    setSavingEmail(true)
    await saveProfile({
      nextEmail: email,
      onFinally: () => setSavingEmail(false),
    })
  }

  const updateGradYear = async () => {
    if (gradYear === savedGradYear) return
    if (savingGrad) return
    setSavingGrad(true)
    await saveProfile({
      nextGradYear: gradYear,
      onFinally: () => setSavingGrad(false),
    })
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
      const emailToUse = savedEmail || email

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
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

  const handleResumeUpload = async (fileToUpload?: File) => {
    if (uploadingResume) return
    const file = fileToUpload ?? resumeFile
    if (!userId || !file) {
      setUploadError('Select a PDF first')
      return
    }
    setUploadingResume(true)
    setUploadError(null)

    try {
      const presignResp = await api.post('/me/resumes/upload', {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      })

      if (!presignResp.ok) {
        throw new Error('Could not get upload URL')
      }

      const { uploadUrl, key, resumeId } = await presignResp.json()

      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResp.ok) {
        throw new Error('Upload failed')
      }

      const saveResp = await api.post('/resumes/save', {
        resume_id: resumeId,
        key,
        file_name: file.name,
        file_size_bytes: file.size,
      })

      if (!saveResp.ok) {
        throw new Error('Could not save resume record')
      }

      let interests: string[] = []
      try {
        const interestsResp = await api.get(`/resumes/${resumeId}/possible-interests`)
        if (interestsResp.ok) {
          interests = await interestsResp.json()
        }
      } catch (err) {
        console.error('Error fetching interests', err)
      }

      setCurrentResumeName(file.name)
      setResumeFile(null)
      navigate('/profile-settings/interests', { state: { interests, resumeId } })
    } catch (err) {
      console.error('Resume upload failed', err)
      setUploadError('Could not upload resume. Please try again.')
    } finally {
      setUploadingResume(false)
    }
  }

  if (!cachedProfile) {
    if (status === 'failed') {
      return (
        <div className="profile-blank profile-loading">
          <span className="profile-subtext">could not load your profile.</span>
          <button
            type="button"
            className="profile-check-button"
            onClick={() => void dispatch(fetchUserProfile())}
          >
            retry
          </button>
        </div>
      )
    }
    return <div className="profile-blank profile-loading">loading...</div>
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
                onChange={(event) => {
                  const value = event.target.value
                  setFirstName(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateName('first', firstName)}
                disabled={savingName || firstName === savedFirstName}
              >
                ✓
              </button>
            </div>
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-last-name">last name</label>
            <div className="profile-input-row">
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(event) => {
                  const value = event.target.value
                  setLastName(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateName('last', lastName)}
                disabled={savingName || lastName === savedLastName}
              >
                ✓
              </button>
            </div>
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
            <label htmlFor="profile-email">email</label>
            <div className="profile-input-row">
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => {
                  const value = event.target.value
                  setEmail(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateEmail()}
                disabled={savingEmail || email === savedEmail}
              >
                ✓
              </button>
            </div>
            {emailError && <div className="profile-upload-error">{emailError}</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-grad-year">grad year</label>
            <div className="profile-input-row">
              <input
                id="profile-grad-year"
                type="text"
                value={gradYear}
                onChange={(event) => {
                  const value = event.target.value
                  setGradYear(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateGradYear()}
                disabled={savingGrad || gradYear === savedGradYear}
              >
                ✓
              </button>
            </div>
          </form>
        </div>
        <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="profile-resume-input">resume (pdf)</label>
          <div className="profile-input-row">
            <input
              id="profile-resume-display"
              type="text"
              readOnly
              placeholder="choose a PDF"
              value={resumeFile?.name ?? currentResumeName}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            />
            <input
              ref={fileInputRef}
              id="profile-resume-input"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setResumeFile(file)
                setUploadError(null)
                if (file) {
                  void handleResumeUpload(file)
                }
              }}
            />
          </div>
          {uploadError && <div className="profile-upload-error">{uploadError}</div>}
        </form>
      </div>
    </div>
  )
}
