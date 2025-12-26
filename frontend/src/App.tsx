import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login/login'
import Signup from './components/Signup/Signup'
import Home from './components/Home/home'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'login' | 'signup'>('login')

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

  if (user) {
    return <Home />
  }

  if (view === 'signup') {
    return <Signup onNavigateToLogin={() => setView('login')} />
  }

  return <Login onNavigateToSignup={() => setView('signup')} />
}

export default App
