import { useNavigate } from 'react-router-dom'
import './unauthorized.css'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div className="unauthorized-container">
      <h1 className="unauthorized-code">401</h1>
      <p className="unauthorized-message">
        Unauthorized.{' '}
        <a
          href="#"
          className="unauthorized-link"
          onClick={(e) => { e.preventDefault(); navigate('/login') }}
        >
          Back to login
        </a>
      </p>
    </div>
  )
}
