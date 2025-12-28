import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login/login'
import Signup from './components/Signup/signup'
import Home from './components/Home/home'
import Onboarding from './components/Onboarding/onboarding'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      
      // Check if user needs to see onboarding
      if (session?.user) {
        const onboardingCompleted = session.user.user_metadata?.onboarding_completed
        setShowOnboarding(!onboardingCompleted)
      }
      
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      
      // Check if user needs to see onboarding
      if (session?.user) {
        const onboardingCompleted = session.user.user_metadata?.onboarding_completed
        setShowOnboarding(!onboardingCompleted)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  if (loading) {
    return <div>loading...</div>
  }

  if (user) {
    if (showOnboarding) {
      return <Onboarding onComplete={handleOnboardingComplete} />
    }
    return <Home />
  }

  if (view === 'signup') {
    return <Signup onNavigateToLogin={() => setView('login')} />
  }

  return <Login onNavigateToSignup={() => setView('signup')} />
}

export default App
