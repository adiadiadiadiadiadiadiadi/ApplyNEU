import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './components/Login/login'
import Signup from './components/Signup/signup'
import Home from './components/Home/home'
import Onboarding from './components/Onboarding/onboarding'
import './index.css'
import Automation from './components/Automation/automation'
import Profile from './components/Profile/profile'

function SideNav() {
  return (
    <div className="left-nav-icons">
      <NavLink
        to="/"
        title="Home"
        className={({ isActive }) => `nav-icon${isActive ? ' nav-icon--active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        </svg>
      </NavLink>
      <NavLink
        to="/profile"
        title="Profile"
        className={({ isActive }) => `nav-icon${isActive ? ' nav-icon--active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 11c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-6 9c0-3.31 2.69-6 6-6s6 2.69 6 6H6z"></path>
        </svg>
      </NavLink>
      <NavLink
        to="/automation"
        title="Play"
        className={({ isActive }) => `nav-icon${isActive ? ' nav-icon--active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3l14 9-14 9V3z"></path>
        </svg>
      </NavLink>
    </div>
  )
}

function AuthenticatedLayout() {
  return (
    <>
      <SideNav />
      <Outlet />
    </>
  )
}

function AuthRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/login" element={<Login onNavigateToSignup={() => navigate('/signup')} />} />
      <Route path="/signup" element={<Signup onNavigateToLogin={() => navigate('/login')} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function OnboardingRoutes({ onComplete }: { onComplete: () => void }) {
  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding onComplete={onComplete} />} />
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        const onboardingCompleted = session.user.user_metadata?.onboarding_completed
        setShowOnboarding(!onboardingCompleted)
      } else {
        setShowOnboarding(false)
      }

      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        const onboardingCompleted = session.user.user_metadata?.onboarding_completed
        setShowOnboarding(!onboardingCompleted)
      } else {
        setShowOnboarding(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    navigate('/')
  }

  if (loading) {
    return <div>loading...</div>
  }

  if (!user) {
    return <AuthRoutes />
  }

  if (showOnboarding) {
    return <OnboardingRoutes onComplete={handleOnboardingComplete} />
  }

  return <AppRoutes />
}

export default App
