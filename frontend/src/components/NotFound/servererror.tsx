import './unauthorized.css'

export default function ServerError() {
  return (
    <div className="unauthorized-container">
      <h1 className="unauthorized-code">500</h1>
      <p className="unauthorized-message">
        Error with server.{' '}
        <a
          href="#"
          className="unauthorized-link"
          onClick={(e) => { e.preventDefault(); window.location.reload() }}
        >
          Try again
        </a>
      </p>
    </div>
  )
}
