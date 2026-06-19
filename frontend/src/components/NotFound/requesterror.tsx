import { useLocation, useNavigate } from 'react-router-dom'
import './unauthorized.css'

type RequestErrorState = {
  status?: number
  statusText?: string
  message?: string
}

export default function RequestError() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { status, statusText, message } = (state ?? {}) as RequestErrorState

  const heading = status ? String(status) : 'Error'
  const detail = message || statusText || 'Something went wrong.'

  // Go back to the page that failed so it remounts and refetches — an actual retry.
  const tryAgain = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  return (
    <div className="unauthorized-container">
      <h1 className="unauthorized-code">{heading}</h1>
      <p className="unauthorized-message">
        {detail}{' '}
        <a
          href="#"
          className="unauthorized-link"
          onClick={(e) => { e.preventDefault(); tryAgain() }}
        >
          Try again.
        </a>
      </p>
    </div>
  )
}
