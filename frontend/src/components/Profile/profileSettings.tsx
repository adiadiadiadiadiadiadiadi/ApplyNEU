import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAppSelector } from '../../store'
import ComponentLoader from '../common/ComponentLoader'
import {
  User as UserIcon,
  Mail,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Target,
  Clock,
  Zap,
  Award,
} from 'lucide-react'
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
import './profile.css'

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

export default function ProfileSettings() {
  const navigate = useNavigate()
  const cachedProfile = useAppSelector((state) => state.user.profile)
  const status = useAppSelector((state) => state.user.status)
  const [header, setHeader] = useState<ProfileHeader>({ name: '', email: '' })
  const [userId, setUserId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [savedFirstName, setSavedFirstName] = useState('')
  const [savedLastName, setSavedLastName] = useState('')
  const [savedEmail, setSavedEmail] = useState('')
  const [savedGradYear, setSavedGradYear] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingGrad, setSavingGrad] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [currentResumeName, setCurrentResumeName] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
  const [tasksSummary, setTasksSummary] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  useEffect(() => {
    if (cachedProfile) {
      setUserId((prev) => prev || cachedProfile.id)
      if (!firstName) setFirstName(cachedProfile.firstName)
      if (!lastName) setLastName(cachedProfile.lastName)
      if (!email) setEmail(cachedProfile.email)
      if (!gradYear) setGradYear(cachedProfile.gradYear)
      setSavedFirstName((prev) => prev || cachedProfile.firstName)
      setSavedLastName((prev) => prev || cachedProfile.lastName)
      setSavedEmail((prev) => prev || cachedProfile.email)
      setSavedGradYear((prev) => prev || cachedProfile.gradYear)
      setHeader((prev) => {
        if (prev.name || prev.email) return prev
        const full = `${cachedProfile.firstName} ${cachedProfile.lastName}`.trim()
        return { name: full || cachedProfile.email, email: cachedProfile.email }
      })
    }
  }, [cachedProfile, firstName, lastName, email, gradYear])

  if (status === 'loading' || !cachedProfile) {
    return (
      <div className="profile-page">
        <div className="profile-inner">
          <h1 className="profile-title">profile settings</h1>
          <ComponentLoader label="loading profile" />
        </div>
      </div>
    )
  }

  useEffect(() => {
    const loadName = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) return

      setUserId(user.id)

      const first = (user.user_metadata?.first_name ?? '').toString().trim()
      const last = (user.user_metadata?.last_name ?? '').toString().trim()
      const grad = (user.user_metadata?.grad_year ?? '').toString().trim()
      const full = `${first} ${last}`.trim()
      const emailFromAuth = (user.email ?? '').trim()

      try {
        const resp = await fetch(`http://localhost:8080/users/${user.id}`)
        if (resp.ok) {
          const userRow = await resp.json()
          const first = (userRow.first_name ?? '').toString()
          const last = (userRow.last_name ?? '').toString()
          const emailVal = (userRow.email ?? '').toString()
          const gradVal = (userRow.grad_year ?? '').toString()
          setFirstName(first)
          setLastName(last)
          setEmail(emailVal)
          setGradYear(gradVal)
          setSavedFirstName(first)
          setSavedLastName(last)
          setSavedEmail(emailVal)
          setSavedGradYear(gradVal)
          const dbFull = `${userRow.first_name ?? ''} ${userRow.last_name ?? ''}`.trim()
          setHeader({
            name: dbFull || userRow.email || '',
            email: (userRow.email ?? '').toString(),
          })
          try {
            const latestResumeResp = await fetch(`http://localhost:8080/resumes/${user.id}/latest`)
            if (latestResumeResp.ok) {
              const latest = await latestResumeResp.json()
              setCurrentResumeName((latest.file_name ?? '').toString())
            }
          } catch (err) {
            console.error('Failed fetching latest resume', err)
          }
          return
        }
      } catch (err) {
        console.error('Failed fetching user from backend', err)
      }

      setFirstName(first)
      setLastName(last)
      setEmail(emailFromAuth)
      setGradYear(grad)
      setSavedFirstName(first)
      setSavedLastName(last)
      setSavedEmail(emailFromAuth)
      setSavedGradYear(grad)
      setHeader({
        name: full || emailFromAuth || '',
        email: emailFromAuth,
      })
    }

    void loadName()
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

  // prevent page scroll while on profile settings
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const saveProfile = async ({
    nextFirst,
    nextLast,
    nextEmail,
    nextGradYear,
    onFinally,
  }: {
    nextFirst?: string
    nextLast?: string
    nextEmail?: string
    nextGradYear?: string
    onFinally: () => void
  }) => {
    if (!userId) {
      onFinally()
      return
    }

    const finalFirst = nextFirst ?? firstName
    const finalLast = nextLast ?? lastName
    const finalEmail = (nextEmail ?? email).trim()
    const finalGradYear = nextGradYear ?? gradYear
    const gradYearNumber = Number.parseInt(finalGradYear, 10)

    if (Number.isNaN(gradYearNumber)) {
      console.error('Graduation year must be a number')
      onFinally()
      return
    }

    try {
      const resp = await fetch(`http://localhost:8080/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: finalFirst,
          last_name: finalLast,
          email: finalEmail,
          grad_year: gradYearNumber,
        }),
      })

      if (!resp.ok) {
        console.error('Failed updating user in postgres')
        return
      }

      const updated = await resp.json()
      setFirstName(updated.first_name ?? finalFirst)
      setLastName(updated.last_name ?? finalLast)
      setEmail(updated.email ?? finalEmail)
      setGradYear((updated.grad_year ?? gradYearNumber).toString())
      setSavedFirstName(updated.first_name ?? finalFirst)
      setSavedLastName(updated.last_name ?? finalLast)
      setSavedEmail(updated.email ?? finalEmail)
      setSavedGradYear((updated.grad_year ?? gradYearNumber).toString())
      setHeader((prev) => {
        const full = `${updated.first_name ?? finalFirst} ${updated.last_name ?? finalLast}`.trim()
        return { ...prev, name: full || prev.email, email: updated.email ?? finalEmail }
      })
    } catch (err) {
      console.error('Error updating user in postgres', err)
    } finally {
      onFinally()
    }
  }

  const updateName = async (part: 'first' | 'last', value: string) => {
    if ((part === 'first' && value === savedFirstName) || (part === 'last' && value === savedLastName)) {
      return
    }
    if (savingName) return
    setSavingName(true)
    const nextFirst = part === 'first' ? value : undefined
    const nextLast = part === 'last' ? value : undefined
    await saveProfile({
      nextFirst,
      nextLast,
      onFinally: () => setSavingName(false),
    })
  }

  const updateEmail = async () => {
    setEmailError(null)
    if (email.toLowerCase().endsWith('@northeastern.edu')) {
      setEmailError('northeastern.edu emails are not allowed.')
      return
    }
    if (email === savedEmail) return
    if (savingEmail) return
    setSavingEmail(true)
    await saveProfile({
      nextEmail: email,
      onFinally: () => setSavingEmail(false),
    })
  }

  const updateGradYear = async () => {
    if (gradYear === savedGradYear) return
    if (savingGrad) return
    setSavingGrad(true)
    await saveProfile({
      nextGradYear: gradYear,
      onFinally: () => setSavingGrad(false),
    })
  }

  const updatePassword = async () => {
    if (savingPassword) return
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Enter all password fields.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords must match.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }

    setSavingPassword(true)
    try {
      const emailToUse = savedEmail || email

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError('Current password is incorrect.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setPasswordError('Could not update password.')
        return
      }

      setPasswordSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error('Error updating password', err)
      setPasswordError('Unexpected error updating password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleResumeUpload = async (fileToUpload?: File) => {
    if (uploadingResume) return
    const file = fileToUpload ?? resumeFile
    if (!userId || !file) {
      setUploadError('Select a PDF first')
      return
    }
    setUploadingResume(true)
    setUploadError(null)

    try {
      const presignResp = await fetch('http://localhost:8080/resumes/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        }),
      })

      if (!presignResp.ok) {
        throw new Error('Could not get upload URL')
      }

      const { uploadUrl, key, resumeId } = await presignResp.json()

      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResp.ok) {
        throw new Error('Upload failed')
      }

      const saveResp = await fetch('http://localhost:8080/resumes/save-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: resumeId,
          key,
          user_id: userId,
          file_name: file.name,
          file_size_bytes: file.size,
        }),
      })

      if (!saveResp.ok) {
        throw new Error('Could not save resume record')
      }

      await fetch(`http://localhost:8080/users/${userId}/cache-short-resume`, { method: 'POST' })

      let interests: string[] = []
      try {
        const interestsResp = await fetch(`http://localhost:8080/resumes/${userId}/possible-interests`)
        if (interestsResp.ok) {
          interests = await interestsResp.json()
        }
      } catch (err) {
        console.error('Error fetching interests', err)
      }

      setCurrentResumeName(file.name)
      setResumeFile(null)
      navigate('/profile-settings/interests', { state: { interests } })
    } catch (err) {
      console.error('Resume upload failed', err)
      setUploadError('Could not upload resume. Please try again.')
    } finally {
      setUploadingResume(false)
    }
  }

  if (!header.name || !header.email) {
    return (
      <div className="profile-blank profile-loading">
        <ComponentLoader label="loading profile" />
      </div>
    )
  }

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

  return (
    <div className="profile-blank">
      <div className="profile-content">
        <div className="profile-header-row">
          <h1 className="welcome-message">
            <button
              type="button"
              className="profile-header-back"
              aria-label="Back to settings"
              onClick={() => navigate('/settings')}
            >
              ←
            </button>
            profile settings
          </h1>
        </div>
        <div className="profile-metrics">
          <div className="metrics-top">
            <div className="metrics-card metrics-profile">
              <div className="metrics-avatar">
                <UserIcon className="metrics-avatar-icon" />
              </div>
              <div className="metrics-profile-text">
                <h2>{header.name}</h2>
                <div className="metrics-email">
                  <Mail className="metrics-email-icon" />
                  <span>{header.email}</span>
                </div>
              </div>
            </div>
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

          <div className="metrics-grid">
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
                <h3>By Company</h3>
              </div>
              <div className="metrics-chart-body">
                {metricsLoading ? (
                  <ComponentLoader />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyData} layout="vertical" barSize={14}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="company" tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip {...tooltipStyle} cursor={{ fill: 'hsl(0 0% 10%)' }} />
                      <Bar dataKey="count" fill="hsl(175, 80%, 50%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
          {metricsError && <p className="metrics-error">{metricsError}</p>}
        </div>
        <div className="profile-forms-row">
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-first-name">first name</label>
            <div className="profile-input-row">
              <input
                id="profile-first-name"
                type="text"
                value={firstName}
                onChange={(event) => {
                  const value = event.target.value
                  setFirstName(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateName('first', firstName)}
                disabled={savingName || firstName === savedFirstName}
              >
                ✓
              </button>
            </div>
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-last-name">last name</label>
            <div className="profile-input-row">
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(event) => {
                  const value = event.target.value
                  setLastName(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateName('last', lastName)}
                disabled={savingName || lastName === savedLastName}
              >
                ✓
              </button>
            </div>
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-current-password">current password</label>
            <div className="profile-input-row">
              <input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-new-password">password</label>
            <div className="profile-input-row profile-two-col">
              <input
                id="profile-new-password"
                type="password"
                className="profile-two-col__item"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <input
                id="profile-confirm-password"
                type="password"
                className="profile-two-col__item"
                placeholder="new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updatePassword()}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                ✓
              </button>
            </div>
            {passwordError && <div className="profile-upload-error">{passwordError}</div>}
            {passwordSuccess && <div className="profile-success">{passwordSuccess}</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-email">email</label>
            <div className="profile-input-row">
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(event) => {
                  const value = event.target.value
                  setEmail(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateEmail()}
                disabled={savingEmail || email === savedEmail}
              >
                ✓
              </button>
            </div>
            {emailError && <div className="profile-upload-error">{emailError}</div>}
          </form>
          <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="profile-grad-year">grad year</label>
            <div className="profile-input-row">
              <input
                id="profile-grad-year"
                type="text"
                value={gradYear}
                onChange={(event) => {
                  const value = event.target.value
                  setGradYear(value)
                }}
              />
              <button
                type="button"
                className="profile-check-button"
                onClick={() => void updateGradYear()}
                disabled={savingGrad || gradYear === savedGradYear}
              >
                ✓
              </button>
            </div>
          </form>
        </div>
        <form className="profile-field" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="profile-resume-input">resume (pdf)</label>
          <div className="profile-input-row">
            <input
              id="profile-resume-display"
              type="text"
              readOnly
              placeholder="choose a PDF"
              value={resumeFile?.name ?? currentResumeName}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
            />
            <input
              ref={fileInputRef}
              id="profile-resume-input"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null
                setResumeFile(file)
                setUploadError(null)
                if (file) {
                  void handleResumeUpload(file)
                }
              }}
            />
          </div>
          {uploadError && <div className="profile-upload-error">{uploadError}</div>}
        </form>
      </div>
    </div>
  )
}
