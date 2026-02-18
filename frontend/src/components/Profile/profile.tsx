import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './profile.css'

type ProfileHeader = {
  name: string
  email: string
}

export default function Profile() {
  const [header, setHeader] = useState<ProfileHeader>({ name: '', email: '' })
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

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

  if (!header.name || !header.email) {
    return <div className="profile-blank profile-loading">loading...</div>
  }

  return (
    <div className="profile-blank">
      <h1 className="welcome-message">
        {header.name}
        {header.email && <span className="welcome-email">{header.email}</span>}
      </h1>
      <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="profile-first-name">First name</label>
        <input
          id="profile-first-name"
          type="text"
          value={firstName}
          onChange={(event) => {
            const value = event.target.value
            setFirstName(value)
            setHeader((prev) => {
              const full = `${value} ${lastName}`.trim()
              return { ...prev, name: full || prev.email }
            })
          }}
        />
      </form>
      <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="profile-last-name">Last name</label>
        <input
          id="profile-last-name"
          type="text"
          value={lastName}
          onChange={(event) => {
            const value = event.target.value
            setLastName(value)
            setHeader((prev) => {
              const full = `${firstName} ${value}`.trim()
              return { ...prev, name: full || prev.email }
            })
          }}
        />
      </form>
    </div>
  )
}
