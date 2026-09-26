import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchUserProfile } from '../../store/userSlice'
import { suppressErrorRedirect, releaseErrorRedirect } from '../../lib/fetchErrorControl'
import './settings.css'

type ResumeRow = {
  resume_id: string
  file_name: string
  upload_complete?: boolean
  is_primary?: boolean
}

const LIST_SUPPRESSOR = 'resumes-list'
const SELECT_SUPPRESSOR = 'resumes-select'

export default function Resumes() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((state) => state.user.profile)
  const status = useAppSelector((state) => state.user.status)
  const userId = profile?.id ?? ''
  const [resumes, setResumes] = useState<ResumeRow[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selecting, setSelecting] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!profile && status === 'idle') {
      void dispatch(fetchUserProfile())
    }
  }, [dispatch, profile, status])

  useEffect(() => {
    let cancelled = false

    // The list call is allowed to fail: an older backend 404s it and the /latest
    // fallback below still renders. Suppressed so that 404 cannot trip the global
    // interceptor into replacing this screen with the /error page.
    const loadResumes = async () => {
      suppressErrorRedirect(LIST_SUPPRESSOR)
      try {
        const listResp = await api.get('/me/resumes')
        if (cancelled) return
        if (listResp.ok) {
          const rows = await listResp.json()
          const uploaded = Array.isArray(rows)
            ? rows.filter((row: ResumeRow) => row.upload_complete !== false)
            : []
          if (uploaded.length) {
            setResumes(uploaded)
            setSelectedId((uploaded.find((row: ResumeRow) => row.is_primary) ?? uploaded[0]).resume_id)
            return
          }
        }

        const latestResp = await api.get('/me/resumes/latest')
        if (cancelled || !latestResp.ok) return
        const latest = await latestResp.json()
        if (!latest?.resume_id) return
        setResumes([{ resume_id: latest.resume_id, file_name: latest.file_name ?? '' }])
        setSelectedId(latest.resume_id)
      } catch (err) {
        console.error('Failed fetching resumes', err)
      } finally {
        releaseErrorRedirect(LIST_SUPPRESSOR)
      }
    }

    void loadResumes()
    return () => {
      cancelled = true
    }
  }, [])

  const selectResume = async (resumeId: string) => {
    if (selecting || uploading) return
    const previous = selectedId
    setSelecting(resumeId)
    setSelectedId(resumeId)
    setError(null)
    // Reverts and reports inline, so a failure must not become the /error page.
    suppressErrorRedirect(SELECT_SUPPRESSOR)
    try {
      const resp = await api.put(`/me/resumes/${resumeId}/primary`)
      if (!resp.ok) {
        throw new Error('Could not select resume')
      }
    } catch (err) {
      console.error('Failed selecting resume', err)
      setSelectedId(previous)
      setError('Could not switch resumes. Please try again.')
    } finally {
      releaseErrorRedirect(SELECT_SUPPRESSOR)
      setSelecting(null)
    }
  }

  const uploadResume = async (file: File) => {
    if (uploading) return
    if (!userId) {
      setError('Could not load your account. Try again.')
      return
    }
    setUploading(true)
    setError(null)

    try {
      const presignResp = await api.post('/me/resumes/upload', {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
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

      const saveResp = await api.post('/resumes/save', {
        resume_id: resumeId,
        key,
        file_name: file.name,
        file_size_bytes: file.size,
      })

      if (!saveResp.ok) {
        throw new Error('Could not save resume record')
      }

      let interests: string[] = []
      try {
        const interestsResp = await api.get(`/resumes/${resumeId}/possible-interests`)
        if (interestsResp.ok) {
          interests = await interestsResp.json()
        }
      } catch (err) {
        console.error('Error fetching interests', err)
      }

      navigate('/settings/interests', { state: { interests, resumeId } })
    } catch (err) {
      console.error('Resume upload failed', err)
      setError('Could not upload resume. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="settings-page page-stagger">
      <div className="settings-inner stagger-children">
        <h1 className="settings-title">
          <button
            type="button"
            className="settings-back"
            aria-label="Back to settings"
            onClick={() => navigate('/settings')}
          >
            ←
          </button>
          resume picker
        </h1>

        <div className="settings-card resume-card">
          <ul className="resume-list" role="radiogroup" aria-label="primary resume">
            {resumes.map((resume) => {
              const isSelected = resume.resume_id === selectedId
              return (
                <li
                  key={resume.resume_id}
                  className={`resume-row ${isSelected ? 'resume-row--selected' : ''}`}
                >
                  <span className="resume-row__name">{resume.file_name}</span>
                  <button
                    type="button"
                    className={`resume-row__check ${isSelected ? 'resume-row__check--on' : ''}`}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Use ${resume.file_name}`}
                    onClick={() => !isSelected && void selectResume(resume.resume_id)}
                    disabled={selecting !== null || uploading}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              )
            })}
            <li className="resume-row resume-row--add">
              <button
                type="button"
                className="resume-row__add"
                aria-label="Upload a new resume"
                title="upload a new resume (pdf, up to 10MB)"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || selecting !== null}
              >
                {uploading ? 'uploading...' : '+'}
              </button>
            </li>
          </ul>
          <input
            ref={fileInputRef}
            id="resumes-upload-input"
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              setError(null)
              event.target.value = ''
              if (file) {
                void uploadResume(file)
              }
            }}
          />
        </div>

        {error && <p className="resume-error">{error}</p>}
      </div>
    </div>
  )
}
