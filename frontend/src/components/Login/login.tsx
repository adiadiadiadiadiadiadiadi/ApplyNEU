import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './login.css'

interface LoginProps {
  onNavigateToSignup: () => void
  authError?: string | null
}

const formatError = (msg: string) =>
  msg === 'Failed to fetch' ? 'Network connection failed.' : msg

export default function Login({ onNavigateToSignup, authError }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(authError ?? null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(formatError(error.message))
    }
    setLoading(false)
  }

  const handleGithubLogin = async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'applyneu://auth/callback',
        skipBrowserRedirect: true,
      },
    })

    if (error) {
      setError(formatError(error.message))
    } else if (data.url) {
      window.electronAPI?.openExternal?.(data.url)
    } else {
      setError('Unable to initiate GitHub login.')
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
            onClick={handleGithubLogin}
            className="social-button"
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="social-icon">
              <path
                fill="currentColor"
                d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"
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
