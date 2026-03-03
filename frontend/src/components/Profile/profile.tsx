import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import ComponentLoader from '../common/ComponentLoader'
import { BarChart3, PieChart as PieIcon, TrendingUp, Target, Clock, Zap, Award } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import './profileMetrics.css'

type ProfileHeader = {
  name: string
  email: string
}

const STATUS_COLORS: Record<string, string> = {
  applied: 'hsl(175, 80%, 50%)',
  interview: 'hsl(40, 90%, 55%)',
  offer: 'hsl(145, 60%, 45%)',
  rejected: 'hsl(0, 70%, 55%)',
  pending: 'hsl(0, 0%, 55%)',
  external: 'hsl(220, 10%, 55%)',
}

export default function Profile() {
  const [header, setHeader] = useState<ProfileHeader>({ name: '', email: '' })
  const [userId, setUserId] = useState<string>('')
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [applicationStats, setApplicationStats] = useState({
    total: 0,
    applied: 0,
    interviews: 0,
    offers: 0,
    rejected: 0,
    pending: 0,
    external: 0,
    today: 0,
    week: 0,
    year: 0,
  })
  const [weeklyData, setWeeklyData] = useState<Array<{ week: string; applications: number; responses: number }>>([])
  const [companyData, setCompanyData] = useState<Array<{ company: string; count: number }>>([])
  const [funnel, setFunnel] = useState([
    { label: 'Apply → Response', value: 0 },
    { label: 'Response → Interview', value: 0 },
    { label: 'Interview → Offer', value: 0 },
    { label: 'Overall Success', value: 0 },
  ])
  const [tasksSummary, setTasksSummary] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  useEffect(() => {
    const loadName = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      const first = (user.user_metadata?.first_name ?? '').toString().trim()
      const last = (user.user_metadata?.last_name ?? '').toString().trim()
      const full = `${first} ${last}`.trim()
      const email = (user.email ?? '').trim()
      setHeader({
        name: full || email || '',
        email,
      })
      setUserId(user.id)
    }

    void loadName()
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const loadMetrics = async () => {
      setMetricsLoading(true)
      setMetricsError(null)
      try {
        const statsResp = await fetch(`http://localhost:8080/applications/${userId}/stats`)
        const appsResp = await fetch(`http://localhost:8080/applications/${userId}`)
        const tasksResp = await fetch(`http://localhost:8080/tasks/${userId}?includeCompleted=true`)

        if (!statsResp.ok) throw new Error('stats failed')
        const statsData = await statsResp.json()
        if (!cancelled) {
          setApplicationStats({
            total: Number(statsData.total ?? 0),
            applied: Number(statsData.applied ?? 0),
            interviews: Number(statsData.interviews ?? 0),
            offers: Number(statsData.offers ?? 0),
            rejected: Number(statsData.rejected ?? 0),
            pending: Number(statsData.pending ?? 0),
            external: Number(statsData.external ?? 0),
            today: Number(statsData.today ?? 0),
            week: Number(statsData.week ?? 0),
            year: Number(statsData.year ?? 0),
          })
        }

        let apps: Array<{ status: string; applied_at?: string; company?: string }> = []
        if (appsResp.ok) {
          apps = await appsResp.json()
        }

        if (!cancelled) {
          const now = new Date()
          const startOfWeek = (d: Date) => {
            const copy = new Date(d)
            const day = copy.getDay() || 7
            copy.setHours(0, 0, 0, 0)
            copy.setDate(copy.getDate() - (day - 1))
            return copy
          }

          const weekBuckets: Array<{ label: string; start: Date; end: Date }> = []
          const thisWeekStart = startOfWeek(now)
          for (let i = 3; i >= 0; i -= 1) {
            const start = new Date(thisWeekStart)
            start.setDate(thisWeekStart.getDate() - i * 7)
            const end = new Date(start)
            end.setDate(start.getDate() + 7)
            weekBuckets.push({ label: `W${4 - i}`, start, end })
          }

          const weekCounts = weekBuckets.map((bucket) => ({
            week: bucket.label,
            applications: 0,
            responses: 0,
          }))

          const companyCounts: Record<string, number> = {}

          apps.forEach((app) => {
            const status = (app.status ?? '').toLowerCase()
            const appliedAt = app.applied_at ? new Date(app.applied_at) : null
            const company = (app.company ?? '').toString() || 'Unknown'
            companyCounts[company] = (companyCounts[company] ?? 0) + 1

            if (appliedAt && !Number.isNaN(appliedAt.getTime())) {
              weekBuckets.forEach((bucket, idx) => {
                if (appliedAt >= bucket.start && appliedAt < bucket.end) {
                  weekCounts[idx].applications += 1
                  if (['interview', 'offer', 'rejected'].includes(status)) {
                    weekCounts[idx].responses += 1
                  }
                }
              })
            }
          })

          const companyDataSorted = Object.entries(companyCounts)
            .map(([company, count]) => ({ company, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)

          setWeeklyData(weekCounts)
          setCompanyData(companyDataSorted)
          const total = statsData.total ?? 0
          const responses = (statsData.interviews ?? 0) + (statsData.offers ?? 0) + (statsData.rejected ?? 0)
          const applyToResponse = total > 0 ? Math.round((responses / total) * 100) : 0
          const responseToInterview = responses > 0 ? Math.round(((statsData.interviews ?? 0) / responses) * 100) : 0
          const interviewToOffer =
            (statsData.interviews ?? 0) + (statsData.offers ?? 0) > 0
              ? Math.round(((statsData.offers ?? 0) / ((statsData.interviews ?? 0) + (statsData.offers ?? 0))) * 100)
              : 0
          const overall = total > 0 ? Math.round(((statsData.offers ?? 0) / total) * 100) : 0
          setFunnel([
            { label: 'Apply → Response', value: applyToResponse },
            { label: 'Response → Interview', value: responseToInterview },
            { label: 'Interview → Offer', value: interviewToOffer },
            { label: 'Overall Success', value: overall },
          ])
        }

        if (!cancelled && tasksResp.ok) {
          const tasks = await tasksResp.json()
          const total = Array.isArray(tasks) ? tasks.length : 0
          const done = Array.isArray(tasks) ? tasks.filter((t) => t.completed).length : 0
          setTasksSummary({ done, total })
        }
      } catch (err) {
        if (!cancelled) {
          setMetricsError('Could not load metrics')
        }
      } finally {
        if (!cancelled) {
          setMetricsLoading(false)
        }
      }
    }

    void loadMetrics()
    return () => {
      cancelled = true
    }
  }, [userId])

  const tooltipStyle = {
    contentStyle: {
      background: 'hsl(0 0% 7%)',
      border: '1px solid hsl(0 0% 14%)',
      borderRadius: '8px',
      fontSize: '12px',
    },
    itemStyle: { color: 'hsl(0 0% 95%)' },
  }

  const pieData = [
    { name: 'Applied', value: applicationStats.applied },
    { name: 'Interview', value: applicationStats.interviews },
    { name: 'Offer', value: applicationStats.offers },
    { name: 'Rejected', value: applicationStats.rejected },
    { name: 'Pending', value: applicationStats.pending },
    { name: 'External', value: applicationStats.external },
  ].filter((d) => d.value > 0)

  const statusBarData = [
    { status: 'Applied', count: applicationStats.applied },
    { status: 'Interview', count: applicationStats.interviews },
    { status: 'Offer', count: applicationStats.offers },
    { status: 'Rejected', count: applicationStats.rejected },
    { status: 'Pending', count: applicationStats.pending },
    { status: 'External', count: applicationStats.external },
  ].filter((d) => d.count > 0)

  const quickStats = [
    { label: 'Applications', value: applicationStats.total, icon: Clock, accent: false },
    { label: 'This week', value: applicationStats.week, icon: Zap, accent: true },
    { label: 'Tasks Done', value: `${tasksSummary.done}/${tasksSummary.total}`, icon: Award, accent: false },
    { label: 'Today', value: applicationStats.today, icon: BarChart3, accent: true },
  ]

  if (!header.name || !header.email) {
    return (
      <div className="metrics-page metrics-loading page-stagger">
        <ComponentLoader label="loading profile" />
      </div>
    )
  }

  return (
    <div className="metrics-page page-stagger">
      <div className="metrics-content stagger-children">
        <div className="metrics-user-inline">
          <span className="metrics-user-name">{header.name}</span>
          <span className="metrics-user-email-inline">{header.email}</span>
        </div>
        <div className="metrics-top stagger-children">
          {quickStats.map((s) => (
            <div key={s.label} className="metrics-card metrics-stat">
              <s.icon className="metrics-stat-icon" />
              <div>
                <p className="metrics-stat-label">{s.label}</p>
                <p className={`metrics-stat-value ${s.accent ? 'metrics-stat-value--accent' : ''}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="metrics-grid stagger-children">
          <div className="metrics-card metrics-chart">
            <div className="metrics-card-header">
              <PieIcon className="metrics-card-icon" />
              <h3>Status Breakdown</h3>
            </div>
            <div className="metrics-chart-body">
              {metricsLoading ? (
                <ComponentLoader />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="40%" outerRadius="65%" dataKey="value" stroke="none">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name.toLowerCase()] || STATUS_COLORS.pending} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="metrics-legend">
              {pieData.map((d) => (
                <div key={d.name} className="metrics-legend-item">
                  <span className="metrics-legend-dot" style={{ background: STATUS_COLORS[d.name.toLowerCase()] }} />
                  <span>{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="metrics-card metrics-chart">
            <div className="metrics-card-header">
              <BarChart3 className="metrics-card-icon" />
              <h3>By Status</h3>
            </div>
            <div className="metrics-chart-body">
              {metricsLoading ? (
                <ComponentLoader />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusBarData} barSize={20}>
                    <XAxis dataKey="status" tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(0 0% 10%)' }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {statusBarData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status.toLowerCase()] || STATUS_COLORS.pending} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="metrics-card metrics-chart">
            <div className="metrics-card-header">
              <TrendingUp className="metrics-card-icon" />
              <h3>Weekly Activity</h3>
            </div>
            <div className="metrics-chart-body">
              {metricsLoading ? (
                <ComponentLoader />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(40, 90%, 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Area type="monotone" dataKey="applications" stroke="hsl(175, 80%, 50%)" fill="url(#areaGrad1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="responses" stroke="hsl(40, 90%, 55%)" fill="url(#areaGrad2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="metrics-card metrics-chart">
            <div className="metrics-card-header">
              <Target className="metrics-card-icon" />
              <h3>Conversion Funnel</h3>
            </div>
            <div className="metrics-chart-body funnel-grid">
              {metricsLoading ? (
                <ComponentLoader />
              ) : (
                funnel.map((step) => (
                  <div key={step.label} className="funnel-step">
                    <div className="funnel-row">
                      <span className="funnel-label">{step.label}</span>
                      <span className="funnel-value">{step.value}%</span>
                    </div>
                    <div className="funnel-bar">
                      <div className="funnel-bar-fill" style={{ width: `${Math.max(step.value, 3)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {metricsError && <p className="metrics-error">{metricsError}</p>}
      </div>
    </div>
  )
}
