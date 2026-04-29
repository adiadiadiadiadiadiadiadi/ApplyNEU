import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { navigateTo } from '../../lib/navigation'

type FetchErrorState = {
  message: string | null
  retry?: (() => void) | null
}

type FetchErrorContextValue = {
  state: FetchErrorState
  setError: (msg: string | null, retry?: (() => void) | null) => void
  clear: () => void
}

const FetchErrorContext = createContext<FetchErrorContextValue>({
  state: { message: null, retry: null },
  setError: () => {},
  clear: () => {}
})

export const FetchErrorProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<FetchErrorState>({ message: null, retry: null })

  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args) => {
      try {
        const res = await originalFetch(...args)
        if (res.status === 401) {
          navigateTo('/401')
          return res
        }
        if (!res.ok) {
          setState({ message: 'Failed to fetch. Please try again.', retry: () => window.location.reload() })
        }
        return res
      } catch (err) {
        setState({ message: 'Failed to fetch. Please check your connection.', retry: () => window.location.reload() })
        throw err
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  const clear = () => setState({ message: null, retry: null })
  const setError = (msg: string | null, retry?: (() => void) | null) => setState({ message: msg, retry: retry ?? null })

  const value = useMemo(
    () => ({
      state,
      setError,
      clear
    }),
    [state]
  )

  return <FetchErrorContext.Provider value={value}>{children}</FetchErrorContext.Provider>
}

export const useFetchError = () => useContext(FetchErrorContext)

export const FetchErrorBanner = () => {
  const { state, clear } = useFetchError()
  const { message, retry } = state

  if (!message) return null

  return (
    <div className="fetch-error-banner" role="alert" aria-live="assertive">
      <span className="fetch-error-text">{message}</span>
      <div className="fetch-error-actions">
        {retry ? (
          <button
            type="button"
            className="fetch-error-retry"
            onClick={() => {
              retry()
              clear()
            }}
          >
            retry
          </button>
        ) : null}
        <button type="button" className="fetch-error-dismiss" onClick={clear} aria-label="Dismiss fetch error">
        dismiss
      </button>
      </div>
    </div>
  )
}
