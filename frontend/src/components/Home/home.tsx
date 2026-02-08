import './home.css'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

interface HomeProps {
  onNavigateToAutomation: () => void
}

export default function Home({ onNavigateToAutomation: _onNavigateToAutomation }: HomeProps) {
  const [tasks, setTasks] = useState<{ task_id: string; text: string }[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  void _onNavigateToAutomation

  useEffect(() => {
    const fetchTasks = async () => {
      setLoadingTasks(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingTasks(false)
        return
      }
      try {
        const resp = await fetch(`http://localhost:8080/tasks/${user.id}`)
        if (resp.ok) {
          const data = await resp.json()
          setTasks(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        // swallow errors for now
      } finally {
        setLoadingTasks(false)
      }
    }
    fetchTasks()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const tasksTitle = loadingTasks
    ? 'loading...'
    : tasks.length === 0
      ? 'no tasks yet...'
      : `${tasks.length} task${tasks.length === 1 ? '' : 's'} await${tasks.length === 1 ? 's' : ''} you`

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
            {loadingTasks || tasks.length === 0 ? (
              <div className="tile-empty-message">
                {loadingTasks ? 'loading...' : 'no tasks yet...'}
              </div>
            ) : (
              <>
                <div className="tile-content">
                  <span>{tasksTitle}</span>
                  <span className="arrow">→</span>
                </div>
                <div className="tasks-list">
                  {tasks.map(task => (
                    <label key={task.task_id} className="task-item">
                      <input type="checkbox" disabled />
                      <span className="task-text">{task.text}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
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


