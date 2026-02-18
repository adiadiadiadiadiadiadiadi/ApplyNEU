import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './profile.css'

type ProfileHeader = {
  name: string
  email: string
}

export default function ProfileSettings() {
  const [header, setHeader] = useState<ProfileHeader>({ name: '', email: '' })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadName = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      const first = (user.user_metadata?.first_name ?? '').toString().trim()
      const last = (user.user_metadata?.last_name ?? '').toString().trim()
      const full = `${first} ${last}`.trim()
      const email = (user.email ?? '').trim()
      setFirstName(first)
      setLastName(last)
      setHeader({
        name: full || email || '',
        email,
      })
    }

    void loadName()
  }, [])

  const updateName = async (part: 'first' | 'last', value: string) => {
    if (saving) return
    setSaving(true)
    const nextFirst = part === 'first' ? value : firstName
    const nextLast = part === 'last' ? value : lastName
    const { error } = await supabase.auth.updateUser({
      data: { first_name: nextFirst, last_name: nextLast },
    })
    setSaving(false)
    if (error) {
      console.error('Failed updating profile name', error)
      return
    }
    setFirstName(nextFirst)
    setLastName(nextLast)
    setHeader((prev) => {
      const full = `${nextFirst} ${nextLast}`.trim()
      return { ...prev, name: full || prev.email }
    })
  }

  if (!header.name || !header.email) {
    return <div className="profile-blank profile-loading">loading...</div>
  }

  return (
    <div className="profile-blank">
      <div className="profile-content">
        <h1 className="welcome-message">profile settings</h1>
        <div className="profile-forms-row">
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
                disabled={saving}
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
                disabled={saving}
              >
                ✓
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
