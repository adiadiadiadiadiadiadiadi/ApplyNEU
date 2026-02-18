import './home.css'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

type Task = { task_id: string; text: string; completed?: boolean; application_id?: string | null }
type Stats = { today: number; week: number; year: number }

export default function Home() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showActive, setShowActive] = useState(true)
  const [stats, setStats] = useState<Stats>({ today: 0, week: 0, year: 0 })
  const [loadingStats, setLoadingStats] = useState(false)

  const sortTasks = (list: Task[]) => [...list]

  const fetchTasks = async () => {
    setLoadingTasks(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadingTasks(false)
      return
    }
    try {
      const resp = await fetch(`http://localhost:8080/tasks/${user.id}?includeCompleted=true`)
      if (resp.ok) {
        const data = await resp.json()
        const parsedTasks = Array.isArray(data)
          ? data
              .map((task: any) => ({
                task_id: String(task?.task_id ?? ''),
                text: String(task?.text ?? ''),
                application_id: task?.application_id ?? null,
                completed: Boolean(task?.completed)
              }))
              .filter(task => task.task_id && task.text)
          : []
        const active = sortTasks(parsedTasks.filter(task => !task.completed))
        const completed = sortTasks(parsedTasks.filter(task => task.completed))
        setActiveTasks(active)
        setCompletedTasks(completed)
      }
    } catch (err) {
      // swallow errors for now
    } finally {
      setLoadingTasks(false)
    }
  }

  const fetchStats = async () => {
    setLoadingStats(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoadingStats(false)
      return
    }
    try {
      const resp = await fetch(`http://localhost:8080/applications/${user.id}/stats`)
      if (resp.ok) {
        const data = await resp.json()
        setStats({
          today: Number(data?.today ?? 0),
          week: Number(data?.week ?? 0),
          year: Number(data?.year ?? 0),
        })
      }
    } catch (err) {
      // swallow errors for now
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchStats()
  }, [])

  const handleToggle = async (taskId: string) => {
    setToggling(taskId)

    const activeMatch = activeTasks.find(t => t.task_id === taskId)
    const completedMatch = completedTasks.find(t => t.task_id === taskId)

    if (activeMatch) {
      const moved = { ...activeMatch, completed: true }
      setActiveTasks(prev => prev.filter(t => t.task_id !== taskId))
      setCompletedTasks(prev => sortTasks([moved, ...prev]))
    } else if (completedMatch) {
      const moved = { ...completedMatch, completed: false }
      setCompletedTasks(prev => prev.filter(t => t.task_id !== taskId))
      setActiveTasks(prev => sortTasks([moved, ...prev]))
    }

    try {
      await fetch(`http://localhost:8080/tasks/${taskId}/complete`, { method: 'PUT' })
    } catch (err) {
      // swallow errors for now
    } finally {
      setToggling(null)
    }
  }

  const handleArchiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked
    setShowActive(next)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const displayedTasks = showActive ? activeTasks : completedTasks

  const tasksTitle =
    displayedTasks.length === 0
      ? showActive
        ? 'no tasks yet...'
        : 'no completed tasks'
      : showActive
        ? `${displayedTasks.length} task${displayedTasks.length === 1 ? '' : 's'} await${displayedTasks.length === 1 ? 's' : ''} you`
        : `${displayedTasks.length} completed`

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
            <div className="tile-header">
              <div className={`tile-content tile-content--tasks ${(loadingTasks || displayedTasks.length === 0) ? 'tile-content--hidden' : ''}`}>
                <span>{tasksTitle}</span>
                <span className="arrow">→</span>
              </div>
              {!loadingTasks && (
                <label className="archive-toggle" title="Show tasks needing attention">
                  <input
                    type="checkbox"
                    checked={showActive}
                    onChange={handleArchiveToggle}
                  />
                  <span className="archive-visual" aria-hidden="true">
                    {showActive ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h18v4H3z"></path>
                        <path d="M5 7v14h14V7"></path>
                        <path d="M10 11h4"></path>
                      </svg>
                    )}
                  </span>
                </label>
              )}
            </div>
            {loadingTasks ? (
              <div className="tile-loading-centered">
                <span className="tile-loading-text">loading...</span>
              </div>
            ) : displayedTasks.length === 0 ? (
              <div className="tile-empty-message">no tasks yet...</div>
            ) : (
              <div className="tasks-list">
                {displayedTasks.map(task => (
                  <label key={task.task_id} className="task-item">
                    <input
                      type="checkbox"
                      onChange={() => handleToggle(task.task_id)}
                      disabled={toggling === task.task_id}
                      checked={Boolean(task.completed)}
                    />
                    <span className="task-text">{task.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="tile tile--equal tile--stats">
            <div className="tile-content">
              <span>your stats </span>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{loadingStats ? '—' : stats.today}</span>
                <span className="stat-label">today</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{loadingStats ? '—' : stats.week}</span>
                <span className="stat-label">this week</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{loadingStats ? '—' : stats.year}</span>
                <span className="stat-label">this year</span>
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


