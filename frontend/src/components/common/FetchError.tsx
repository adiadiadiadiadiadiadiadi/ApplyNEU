import { useEffect } from 'react'
import { navigateTo } from '../../lib/navigation'
import { isErrorRedirectSuppressed } from '../../lib/fetchErrorControl'
import { supabase } from '../../lib/supabase'

// Only our own backend calls get the global error handling. Third-party fetches
// (Supabase auth, external URLs) manage their own retries/errors, so a transient
// network blip during e.g. getUser() must not hijack the whole app to /error.
const API_BASE = 'http://localhost:8080'

const requestUrl = (input: unknown): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (input instanceof Request) return input.url
  return ''
}

// Avoid stacking duplicate redirects when a burst of requests all fail at once.
const isOnErrorPage = () => {
  const hash = window.location.hash
  return hash.startsWith('#/error') || hash.startsWith('#/401')
}

export const FetchErrorProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      // Leave non-backend requests (Supabase, external) completely untouched.
      if (!requestUrl(args[0]).startsWith(API_BASE)) {
        return originalFetch(...args)
      }
      try {
        const res = await originalFetch(...args)
        if (res.status === 401) {
          await supabase.auth.signOut()
          navigateTo('/401')
          return res
        }
        if (!res.ok && !isOnErrorPage() && !isErrorRedirectSuppressed()) {
          // Show a full-page fallback with the received error instead of a banner.
          // Suppressed screens (e.g. Automation) handle/log their own errors.
          navigateTo('/error', { state: { status: res.status, statusText: res.statusText } })
        }
        return res
      } catch (err) {
        if (!isOnErrorPage() && !isErrorRedirectSuppressed()) {
          navigateTo('/error', { state: { message: 'Could not reach the server.' } })
        }
        throw err
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return <>{children}</>
}
