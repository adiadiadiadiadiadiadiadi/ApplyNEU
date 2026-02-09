import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './profile.css'

type ProfileState = {
  firstName: string
  lastName: string
  graduationYear: string
  email: string
}

export default function Profile() {
  const [form, setForm] = useState<ProfileState>({
    firstName: '',
    lastName: '',
    graduationYear: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        setStatus('unable to load profile')
        return
      }

      setForm({
        firstName: data.user.user_metadata?.first_name ?? '',
        lastName: data.user.user_metadata?.last_name ?? '',
        graduationYear: data.user.user_metadata?.graduation_year ?? '',
        email: data.user.email ?? '',
      })
    }

    void loadUser()
  }, [])

  const handleChange = (field: keyof ProfileState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatus(null)

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: form.firstName,
        last_name: form.lastName,
        graduation_year: form.graduationYear,
      },
    })

    if (error) {
      setStatus(error.message)
    } else {
      setStatus('saved')
    }

    setSaving(false)
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <h1 className="profile-title">profile</h1>

        <form className="profile-form" onSubmit={handleSave}>
          <label className="profile-label">
            email
            <input
              type="email"
              value={form.email}
              disabled
              className="profile-input profile-input--disabled"
            />
          </label>

          <div className="profile-row">
            <label className="profile-label">
              first name
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="profile-input"
                required
              />
            </label>
            <label className="profile-label">
              last name
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="profile-input"
                required
              />
            </label>
          </div>

          <label className="profile-label">
            graduation year
            <input
              type="text"
              value={form.graduationYear}
              onChange={(e) => handleChange('graduationYear', e.target.value)}
              className="profile-input"
              placeholder="e.g. 2026"
            />
          </label>

          {status && <div className="profile-status">{status}</div>}

          <button type="submit" className="profile-button" disabled={saving}>
            {saving ? 'saving...' : 'save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
