import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login/login'
import Signup from './components/Signup/signup'
import Home from './components/Home/home'
import Onboarding from './components/Onboarding/onboarding'
import Automation from './components/Automation/automation'
import './index.css'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAutomation, setShowAutomation] = useState(false)

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

  const handleShowAutomation = () => {
    setShowAutomation(true)
  }

  const handleBackToDashboard = () => {
    setShowAutomation(false)
  }

  if (loading) {
    return <div>loading...</div>
  }

  if (user) {
    if (showOnboarding) {
      return <Onboarding onComplete={handleOnboardingComplete} />
    }
    if (showAutomation) {
      return (
        <>
          <div className="left-nav-icons">
            <button className="nav-icon" title="Home" onClick={handleBackToDashboard}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
            </button>
            <button className="nav-icon" title="Profile">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-6 9c0-3.31 2.69-6 6-6s6 2.69 6 6H6z"></path>
              </svg>
            </button>
            <button className="nav-icon" title="Play" onClick={handleShowAutomation}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3l14 9-14 9V3z"></path>
              </svg>
            </button>
          </div>
          <Automation onBack={handleBackToDashboard} />
        </>
      )
    }
    return (
      <>
        <div className="left-nav-icons">
          <button className="nav-icon" title="Home">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
          </button>
          <button className="nav-icon" title="Profile">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-6 9c0-3.31 2.69-6 6-6s6 2.69 6 6H6z"></path>
            </svg>
          </button>
          <button className="nav-icon" title="Play" onClick={handleShowAutomation}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l14 9-14 9V3z"></path>
            </svg>
          </button>
        </div>
        <Home onNavigateToAutomation={handleShowAutomation} />
      </>
    )
  }

  if (view === 'signup') {
    return <Signup onNavigateToLogin={() => setView('login')} />
  }

  return <Login onNavigateToSignup={() => setView('signup')} />
}

export default App
