import './home.css'
import { supabase } from '../../lib/supabase'
import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import ComponentLoader from '../common/ComponentLoader'

type Task = { task_id: string; text: string; description?: string; completed?: boolean; application_id?: string | null }

type Stats = {
  total: number; today: number; week: number; year: number;
  applied: number; interviews: number; offers: number; rejected: number; pending: number; external: number;
}

type Application = {
  application_id: string;
  job_id: string;
  company: string;
  title: string;
  description: string;
  status: string;
  applied_at: string;
}

type StatusCfg = { label: string; colorClass: string; icon: React.ReactNode }

const SendIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
)
const EyeIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
)
const CheckCircleIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
)
const XCircleIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
)
const ClockIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
)
const AlertIcon = ({ cls }: { cls: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cls}>
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
)

const STATUS_CONFIG: Record<string, StatusCfg> = {
  applied:                  { label: 'Applied',   colorClass: 'status--applied',   icon: <SendIcon cls="app-icon status--applied" /> },
  submitted:                { label: 'Applied',   colorClass: 'status--applied',   icon: <SendIcon cls="app-icon status--applied" /> },
  pending:                  { label: 'Pending',   colorClass: 'status--pending',   icon: <ClockIcon cls="app-icon status--pending" /> },
  draft:                    { label: 'Draft',     colorClass: 'status--pending',   icon: <ClockIcon cls="app-icon status--pending" /> },
  interview:                { label: 'Interview', colorClass: 'status--interview', icon: <EyeIcon cls="app-icon status--interview" /> },
  offer:                    { label: 'Offer',     colorClass: 'status--offer',     icon: <CheckCircleIcon cls="app-icon status--offer" /> },
  rejected:                 { label: 'Rejected',  colorClass: 'status--rejected',  icon: <XCircleIcon cls="app-icon status--rejected" /> },
  external:                 { label: 'Ext. Action', colorClass: 'status--external', icon: <AlertIcon cls="app-icon status--external" /> },
  'external action needed': { label: 'Ext. Action', colorClass: 'status--external', icon: <AlertIcon cls="app-icon status--external" /> },
}

const PIPELINE_DOTS: Record<string, string> = {
  offer: '#4ade80', interview: '#fbbf24', applied: '#93c5fd',
  submitted: '#93c5fd', pending: '#6b7280', draft: '#6b7280',
  rejected: '#f87171', external: '#fb923c',
}

const normalizeStatusKey = (value: string) => {
  const lower = (value ?? '').trim().toLowerCase()
  if (lower === 'submitted') return 'applied'
  if (lower === 'external action needed' || lower === 'ext' || lower === 'ext. action') return 'external'
  return lower
}

const statusToStatKey = (value: string): keyof Stats | null => {
  const key = normalizeStatusKey(value)
  if (key === 'applied') return 'applied'
  if (key === 'interview') return 'interviews'
  if (key === 'offer') return 'offers'
  if (key === 'rejected') return 'rejected'
  if (key === 'pending' || key === 'draft') return 'pending'
  if (key === 'external') return 'external'
  return null
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'applied',   label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer',     label: 'Offer' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'draft',     label: 'Draft' },
  { value: 'external',  label: 'External' },
]

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function renderDescription(desc: string, title?: string | null) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = Array.from(desc.matchAll(urlRegex)).map(m => m[0])
  const coreTitle = title ? (title.split('@')[0] || title).trim() : ''
  // Preserve first occurrence order but avoid duplicates.
  const uniqueLinks: string[] = []
  for (const link of matches) {
    if (!uniqueLinks.includes(link)) uniqueLinks.push(link)
  }

  const remainingText = desc.replace(urlRegex, '').trim()
  const parts: Array<string | JSX.Element> = []
  if (remainingText) parts.push(remainingText)
  uniqueLinks.forEach((link, idx) => {
    if (parts.length) parts.push(' ')
    parts.push(
      <a
        key={`${link}-${idx}`}
        href={link}
        target="_blank"
        rel="noreferrer noopener"
        className="task-desc-link"
        onClick={e => {
          e.preventDefault()
          try {
            window.open(link, '_blank', 'noopener,noreferrer')
          } catch {
            // fall back to default navigation if blocked
            window.location.assign(link)
          }
        }}
      >
        {link}
      </a>
    )
  })

  if (coreTitle) {
    const lowerDesc = remainingText.toLowerCase()
    if (!lowerDesc.includes(coreTitle.toLowerCase())) {
      if (parts.length) parts.push(' ')
      parts.push(`(${coreTitle})`)
    }
  }

  return parts.length ? parts : (coreTitle ? `(${coreTitle})` : '')
}

export default function Home() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showActive, setShowActive] = useState(true)
  const [stats, setStats] = useState<Stats>({
    total: 0, today: 0, week: 0, year: 0,
    applied: 0, interviews: 0, offers: 0, rejected: 0, pending: 0, external: 0,
  })
  const [loadingStats, setLoadingStats] = useState(false)
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(false)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [statusMenuPos, setStatusMenuPos] = useState<
    | {
        id: string
        above: boolean
        left: number
        top: number
        width: number
      }
    | null
  >(null)
  const fetchTasks = async () => {
    setLoadingTasks(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingTasks(false); return }
    try {
      const resp = await fetch(`http://localhost:8080/tasks/${user.id}?includeCompleted=true`)
      if (resp.ok) {
        const data = await resp.json()
        const parsed: Task[] = Array.isArray(data)
          ? data.map((t: any) => ({
              task_id: String(t?.task_id ?? ''),
              text: String(t?.text ?? ''),
              description: t?.description ? String(t.description) : '',
              application_id: t?.application_id ?? null,
              completed: Boolean(t?.completed),
            })).filter(t => t.task_id && t.text)
          : []
        setActiveTasks(parsed.filter(t => !t.completed))
        setCompletedTasks(parsed.filter(t => t.completed))
      }
    } catch { /* swallow */ }
    finally { setLoadingTasks(false) }
  }

  const fetchStats = async () => {
    setLoadingStats(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingStats(false); return }
    try {
      const resp = await fetch(`http://localhost:8080/applications/${user.id}/stats`)
      if (resp.ok) {
        const d = await resp.json()
        setStats({
          total:      Number(d?.total      ?? 0),
          today:      Number(d?.today      ?? 0),
          week:       Number(d?.week       ?? 0),
          year:       Number(d?.year       ?? 0),
          applied:    Number(d?.applied    ?? 0),
          interviews: Number(d?.interviews ?? 0),
          offers:     Number(d?.offers     ?? 0),
          rejected:   Number(d?.rejected   ?? 0),
          pending:    Number(d?.pending    ?? 0),
          external:   Number(d?.external   ?? 0),
        })
      }
    } catch { /* swallow */ }
    finally { setLoadingStats(false) }
  }

  const fetchApplications = async () => {
    setLoadingApps(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingApps(false); return }
    try {
      const resp = await fetch(`http://localhost:8080/applications/${user.id}`)
      if (resp.ok) {
        const data = await resp.json()
        setApplications(Array.isArray(data) ? data : [])
      }
    } catch { /* swallow */ }
    finally { setLoadingApps(false) }
  }

  const updateApplicationStatus = async (applicationId: string, nextStatus: string) => {
    const current = applications.find(app => app.application_id === applicationId)
    const prevStatKey = current ? statusToStatKey(current.status) : null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUpdatingStatusId(applicationId)
    try {
      const resp = await fetch(`http://localhost:8080/applications/${user.id}/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (resp.ok) {
        const updated = await resp.json().catch(() => ({}))
        const newStatus = (updated?.status ?? nextStatus) as string
        const newStatKey = statusToStatKey(newStatus)
        setApplications(prev =>
          prev.map(app => (app.application_id === applicationId ? { ...app, status: newStatus } : app))
        )
        setStats(prev => {
          const next = { ...prev }
          if (prevStatKey && typeof next[prevStatKey] === 'number') {
            next[prevStatKey] = Math.max(0, (next[prevStatKey] as number) - 1)
          }
          if (newStatKey && typeof next[newStatKey] === 'number') {
            next[newStatKey] = (next[newStatKey] as number) + 1
          }
          return next
        })
      }
    } catch { /* swallow */ }
    finally {
      setUpdatingStatusId(null)
      setOpenStatusId(null)
      setStatusMenuPos(null)
    }
  }

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const withinControl = target?.closest?.('.app-status-control')
      const withinMenu = target?.closest?.('.app-status-menu')
      if (!withinControl && !withinMenu && openStatusId) {
        setOpenStatusId(null)
        setStatusMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [openStatusId])

  useEffect(() => {
    fetchTasks()
    fetchStats()
    fetchApplications()
  }, [])

  const handleToggle = async (taskId: string) => {
    setToggling(taskId)
    const activeMatch = activeTasks.find(t => t.task_id === taskId)
    const completedMatch = completedTasks.find(t => t.task_id === taskId)
    if (activeMatch) {
      setActiveTasks(prev => prev.filter(t => t.task_id !== taskId))
      setCompletedTasks(prev => [{ ...activeMatch, completed: true }, ...prev])
    } else if (completedMatch) {
      setCompletedTasks(prev => prev.filter(t => t.task_id !== taskId))
      setActiveTasks(prev => [{ ...completedMatch, completed: false }, ...prev])
    }
    try {
      await fetch(`http://localhost:8080/tasks/${taskId}/complete`, { method: 'PUT' })
    } catch { /* swallow */ }
    finally { setToggling(null) }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const displayedTasks = showActive ? activeTasks : completedTasks
  const remaining = displayedTasks.filter(t => !t.completed).length

  const applicationTitleById = useMemo(() => {
    const map: Record<string, string> = {}
    applications.forEach(app => {
      if (app.application_id && app.title) map[app.application_id] = app.title
    })
    return map
  }, [applications])

  const responseRate = stats.total > 0
    ? Math.round(((stats.interviews + stats.offers + stats.rejected) / stats.total) * 100)
    : 0

  const pipelineSegments = [
    { key: 'offer',     label: 'Offer',     dot: PIPELINE_DOTS.offer,     count: stats.offers },
    { key: 'interview', label: 'Interview', dot: PIPELINE_DOTS.interview, count: stats.interviews },
    { key: 'applied',   label: 'Applied',   dot: PIPELINE_DOTS.applied,   count: stats.applied },
    { key: 'external',  label: 'Ext. Action', dot: PIPELINE_DOTS.external, count: stats.external },
    { key: 'pending',   label: 'Draft',     dot: PIPELINE_DOTS.pending,   count: stats.pending },
    { key: 'rejected',  label: 'Rejected',  dot: PIPELINE_DOTS.rejected,  count: stats.rejected },
  ]

  const statsRow = [
    { label: 'Total',      value: stats.total,         accent: false },
    { label: 'Applied',    value: stats.applied,       accent: true  },
    { label: 'Interviews', value: stats.interviews,    accent: false },
    { label: 'Offers',     value: stats.offers,        accent: false },
    { label: 'Rejected',   value: stats.rejected,      accent: false },
    { label: 'Response',   value: `${responseRate}%`,  accent: true  },
  ]

  return (
    <>
      <button onClick={handleLogout} className="logout-button" title="Logout">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
      </button>

      <div className="home-dashboard stagger-children">
        {/* Stats row */}
        <div className="stats-row stagger-children">
          {statsRow.map(s => (
            <div key={s.label} className={`stat-pill${s.accent ? ' stat-pill--accent' : ''}`}>
              <span className="stat-pill-label">{s.label}</span>
              <span className="stat-pill-value">{loadingStats ? '—' : s.value}</span>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="dashboard-grid stagger-children">

          {/* Left column */}
          <div className="col-left stagger-children">

            {/* Pipeline panel */}
            <div className="dashboard-panel pipeline-panel">
              <p className="panel-label">Pipeline</p>
              {loadingStats ? (
                <div className="panel-loading">
                  <ComponentLoader label="loading stats" />
                </div>
              ) : (
                <>
                  <div className="pipeline-bar-wrap">
                    <div className="pipeline-bar">
                      {stats.total === 0
                        ? <div className="pipeline-segment" style={{ width: '100%', background: 'rgba(255,255,255,0.08)' }} />
                        : pipelineSegments.map(seg => seg.count > 0 && (
                          <div
                            key={seg.key}
                            className="pipeline-segment"
                            style={{ width: `${(seg.count / stats.total) * 100}%`, background: seg.dot }}
                          />
                        ))
                      }
                    </div>
                  </div>
                  <div className="pipeline-legend">
                    {pipelineSegments.map(seg => (
                      <div key={seg.key} className="legend-item">
                        <span className="legend-dot" style={{ background: seg.dot }} />
                        <span className="legend-label">{seg.label}</span>
                        <span className="legend-count">{seg.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Action Items panel */}
            <div className="dashboard-panel tasks-panel">
              <div className="panel-header">
                <p className="panel-label">Action Items</p>
                <label className="archive-toggle" title={showActive ? 'Show completed' : 'Show active'}>
                  <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
                  <span className="archive-visual" aria-hidden="true">
                    {showActive ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h18v4H3z"></path>
                        <path d="M5 7v14h14V7"></path>
                        <path d="M10 11h4"></path>
                      </svg>
                    )}
                  </span>
                </label>
              </div>
              {loadingTasks ? (
                <div className="panel-loading">
                  <ComponentLoader label="loading tasks" />
                </div>
              ) : displayedTasks.length === 0 ? (
                <div className="panel-empty">{showActive ? 'no tasks yet...' : 'no completed tasks'}</div>
              ) : (
                <div className="tasks-scroll">
                  <p className="tasks-remaining">{remaining} remaining</p>
                  <div className="tasks-list-new">
                    {displayedTasks.map(task => {
                      const hasDescription = !!task.description
                      const taskTitle = task.application_id ? applicationTitleById[task.application_id] : undefined
                      const showDesc = hasDescription || !!taskTitle
                      return (
                        <div key={task.task_id} className="task-item-new">
                          <div className="task-main-row">
                            <button
                              className={`task-checkbox${task.completed ? ' task-checkbox--done' : ''}`}
                              onClick={() => handleToggle(task.task_id)}
                              disabled={toggling === task.task_id}
                            >
                              {task.completed && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                            </button>
                            <span className={`task-label-new${task.completed ? ' task-label-new--done' : ''}`}>
                              {task.text}
                            </span>
                          </div>
                          {showDesc && (
                            <div className="task-desc">
                              {renderDescription(task.description ?? '', taskTitle)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right column — Applications */}
          <div className="col-right stagger-children">
            <div className="dashboard-panel apps-panel">
              <div className="panel-header">
                <p className="panel-label">Applications</p>
                <span className="panel-count">{applications.length} total</span>
              </div>
              {loadingApps ? (
                <div className="panel-loading">
                  <ComponentLoader label="loading applications" />
                </div>
              ) : applications.length === 0 ? (
                <div className="panel-empty">no applications yet...</div>
              ) : (
                <div className="apps-scroll">
                  <div className="apps-list">
                    {applications.map(app => {
                      const statusKey = (app.status ?? '').toLowerCase()
                      const cfg: StatusCfg = STATUS_CONFIG[statusKey] ?? {
                        label: app.status,
                        colorClass: 'status--pending',
                        icon: <ClockIcon cls="app-icon status--pending" />,
                      }
                      const key = app.application_id ?? app.job_id
                      return (
                        <div key={key} className="app-row">
                          <div className="app-left">
                            <span className="app-icon-wrap">{cfg.icon}</span>
                            <div className="app-info">
                              <p className="app-title">{app.title.split(' @ ')[0]}</p>
                              <p className="app-company">{app.company}</p>
                            </div>
                          </div>
                          <div className="app-right">
                        <div className="app-status-control">
                          <button
                                id={`status-btn-${key}`}
                            className={`app-status-btn ${cfg.colorClass}`}
                            type="button"
                                onClick={() => {
                                  setOpenStatusId(prev => (prev === key ? null : key))
                                  const btn = document.getElementById(`status-btn-${key}`)
                                  if (btn) {
                                    const rect = btn.getBoundingClientRect()
                                    const viewportH = window.innerHeight
                                    const menuHeight = 260
                                    const menuWidth = 180
                                    const margin = 8
                                    const above = rect.bottom + menuHeight + margin > viewportH
                                    const top = above ? rect.top - menuHeight - margin : rect.bottom + margin
                                    setStatusMenuPos({
                                      id: key,
                                      above,
                                      left: Math.min(Math.max(rect.right - menuWidth, margin), window.innerWidth - menuWidth - margin),
                                      top,
                                      width: rect.width,
                                    })
                                  } else {
                                    setStatusMenuPos(null)
                                  }
                                }}
                            disabled={updatingStatusId === key}
                          >
                            {cfg.label}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="app-status-caret">
                              <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                          </button>
                          {openStatusId === key && statusMenuPos?.id === key && createPortal(
                            <div
                              className="app-status-menu"
                              style={{
                                position: 'fixed',
                                left: `${statusMenuPos.left}px`,
                                top: `${statusMenuPos.top}px`,
                                transform: 'translateX(0)',
                                zIndex: 2000, // lift above transformed containers
                              }}
                            >
                              {STATUS_OPTIONS.map(opt => {
                                const active = (app.status ?? '').toLowerCase() === opt.value
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    className={`app-status-option${active ? ' is-active' : ''}`}
                                    onClick={() => updateApplicationStatus(app.application_id, opt.value)}
                                    disabled={updatingStatusId === key}
                                  >
                                    {opt.label}
                                  </button>
                                )
                              })}
                            </div>,
                            document.body
                          )}
                        </div>
                            <span className="app-date">{formatDate(app.applied_at)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
