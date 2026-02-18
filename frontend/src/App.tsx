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
import ProfileSettings from './components/Profile/profileSettings'
import ProfileInterests from './components/Profile/profileInterests'
import Settings from './components/Settings/settings'

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
        to="/settings"
        title="Settings"
        className={({ isActive }) => `nav-icon${isActive ? ' nav-icon--active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 10.35 5V4.91a2 2 0 0 1 4 0V5a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
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
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/profile-settings/interests" element={<ProfileInterests />} />
        <Route path="/settings" element={<Settings />} />
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
