import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './profile.css'

type ProfileHeader = {
  name: string
  email: string
}

export default function Profile() {
  const [header, setHeader] = useState<ProfileHeader>({ name: '', email: '' })

  useEffect(() => {
    const loadName = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      const first = (user.user_metadata?.first_name ?? '').toString().trim()
      const last = (user.user_metadata?.last_name ?? '').toString().trim()
      const full = `${first} ${last}`.trim()
      const email = (user.email ?? '').trim()
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
    </div>
  )
}
