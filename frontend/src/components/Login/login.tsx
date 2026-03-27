import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './login.css'

interface LoginProps {
  onNavigateToSignup: () => void
}

export default function Login({ onNavigateToSignup }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleSocialLogin = async (provider: 'google' | 'azure') => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-content stagger-children">
        <h1 className="login-title">welcome back</h1>

        <form onSubmit={handleEmailLogin} className="login-form stagger-children">
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            required
          />

          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
            required
          />

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'loading...' : 'login'}
          </button>
        </form>

        <div className="login-divider">
          <span>or login with</span>
        </div>

        <div className="social-buttons stagger-children">
          <button
            onClick={() => handleSocialLogin('azure')}
            className="social-button"
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="social-icon">
              <path
                fill="currentColor"
                d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"
              />
            </svg>
          </button>
        </div>

        <div className="login-footer">
          don't have an account?{' '}
          <a 
            href="#" 
            onClick={(e) => { 
              e.preventDefault(); 
              onNavigateToSignup(); 
            }} 
            className="login-link"
          >
            register now
          </a>
        </div>
      </div>
    </div>
  )
}
