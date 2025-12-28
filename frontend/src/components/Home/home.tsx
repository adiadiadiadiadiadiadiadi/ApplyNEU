import './home.css'
import { supabase } from '../../lib/supabase'

export default function Home() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <>
      <h1 className="welcome-message">home</h1>
      <button onClick={handleLogout} className="logout-button" title="Logout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>
      <div className="home-container">
        <div className="top-row">
          <div className="tile tile--equal">
            <div className="tile-content">
              <span>6 tasks await you </span>
              <span className="arrow">→</span>
            </div>
            <div className="tasks-list">
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Apply to Meta</span>
              </label>
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Upload Empower Cover Letter</span>
              </label>
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Upload Portfolio</span>
              </label>
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Apply to LinkedIn</span>
              </label>
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Apply to Coverix</span>
              </label>
              <label className="task-item">
                <input type="checkbox" />
                <span className="task-text">Upload Work Sample</span>
              </label>
            </div>
          </div>

          <div className="tile tile--equal">
            <div className="tile-content">
              <span>your stats </span>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">3</span>
                <span className="stat-label">today</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">12</span>
                <span className="stat-label">this week</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">47</span>
                <span className="stat-label">last month</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bottom-row">
          <div className="tile tile--quick">
            <div className="tile-content">
              <span>system status</span>
            </div>
            <div className="status-items">
              <div className="status-item">
                <span className="status-label">Playwright</span>
                <span className="status-badge status-badge--idle">idle</span>
              </div>
              <div className="status-item">
                <span className="status-label">Claude Agent</span>
                <span className="status-badge status-badge--disconnected">disconnected</span>
              </div>
            </div>
          </div>

          <div className="tile tile--quick tile--coming-soon">
            <div className="tile-content">
              <span>coming soon<span className="dots-animation"></span></span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}


