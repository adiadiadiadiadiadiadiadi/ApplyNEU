import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login/login'
import Home from './components/Home/home'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div>loading...</div>
  }

  return user ? <Home /> : <Login />
}

export default App

