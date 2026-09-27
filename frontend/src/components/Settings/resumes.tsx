import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAppDispatch, useAppSelector } from '../../store'
import { fetchUserProfile } from '../../store/userSlice'
import { suppressErrorRedirect, releaseErrorRedirect } from '../../lib/fetchErrorControl'
import ComponentLoader from '../common/ComponentLoader'
import PdfViewer from '../common/PdfViewer'
import './settings.css'

type ResumeRow = {
  resume_id: string
  file_name: string
  created_at?: string
  upload_complete?: boolean
  is_primary?: boolean
  enriched?: boolean
}

const formatUploadDate = (value?: string) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const LIST_SUPPRESSOR = 'resumes-list'
const SELECT_SUPPRESSOR = 'resumes-select'
const VIEW_SUPPRESSOR = 'resumes-view'

export default function Resumes() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const profile = useAppSelector((state) => state.user.profile)
  const status = useAppSelector((state) => state.user.status)
  const userId = profile?.id ?? ''
  const [resumes, setResumes] = useState<ResumeRow[]>([])
  const [loadingResumes, setLoadingResumes] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [selecting, setSelecting] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; fileName: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!viewer) return
    const onKey = ({ key }: { key: string }) => {
      if (key === 'Escape') setViewer(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer])

  useEffect(() => {
    if (!profile && status === 'idle') {
      void dispatch(fetchUserProfile())
    }
  }, [dispatch, profile, status])

  useEffect(() => {
    let cancelled = false

    // The list is the source of truth; /primary only covers the list call erroring
    // out, so an empty list stays empty rather than resurfacing a resume the filter
    // below deliberately dropped. Suppressed so a 404 cannot trip the global
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
          setResumes(uploaded)
          if (uploaded.length) {
            setSelectedId((uploaded.find((row: ResumeRow) => row.is_primary) ?? uploaded[0]).resume_id)
          }
          return
        }

        const primaryResp = await api.get('/me/resumes/primary')
        if (cancelled || !primaryResp.ok) return
        const primary = await primaryResp.json()
        if (!primary?.resume_id) return
        setResumes([{
          resume_id: primary.resume_id,
          file_name: primary.file_name ?? '',
          created_at: primary.created_at,
          is_primary: true,
        }])
        setSelectedId(primary.resume_id)
      } catch (err) {
        console.error('Failed fetching resumes', err)
      } finally {
        releaseErrorRedirect(LIST_SUPPRESSOR)
        if (!cancelled) setLoadingResumes(false)
      }
    }

    void loadResumes()
    return () => {
      cancelled = true
    }
  }, [])

  const viewResume = async (resumeId: string) => {
    if (viewing || uploading) return
    setViewing(resumeId)
    setError(null)
    // Reports inline, so a 404 must not become the /error page.
    suppressErrorRedirect(VIEW_SUPPRESSOR)
    try {
      const resp = await api.get(`/me/resumes/${resumeId}/view`)
      if (!resp.ok) {
        throw new Error('Could not load resume')
      }
      const { viewUrl, fileName } = await resp.json()
      if (!viewUrl) {
        throw new Error('Could not load resume')
      }
      setViewer({ url: viewUrl, fileName: fileName ?? '' })
    } catch (err) {
      console.error('Failed opening resume', err)
      setError('Could not open resume. Please try again.')
    } finally {
      releaseErrorRedirect(VIEW_SUPPRESSOR)
      setViewing(null)
    }
  }

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
      <div className={`settings-inner stagger-children${loadingResumes ? ' settings-inner--loading' : ''}`}>
        <h1 className="settings-title">
          <button
            type="button"
            className="settings-back"
            aria-label="Back to settings"
            onClick={() => navigate('/settings')}
          >
            ←
          </button>
          resumes
        </h1>

        {loadingResumes ? (
          <ComponentLoader fullPage label="loading resumes" />
        ) : (
          <div className="settings-card resume-card">
            <ul className="resume-list" role="radiogroup" aria-label="primary resume">
              {resumes.map((resume) => {
                const isSelected = resume.resume_id === selectedId
                const isEnriched = resume.enriched !== false
                return (
                  <li
                    key={resume.resume_id}
                    className={`resume-row ${isSelected ? 'resume-row--selected' : ''}`}
                  >
                    <span className="resume-row__meta">
                      <span className="resume-row__name">{resume.file_name}</span>
                      {formatUploadDate(resume.created_at) && (
                        <span className="resume-row__date">
                          uploaded {formatUploadDate(resume.created_at)}
                        </span>
                      )}
                    </span>
                    <span className="resume-row__actions">
                      {!isEnriched && (
                        <span
                          className="resume-row__warn"
                          role="img"
                          aria-label="Not enriched yet: no interests or search terms"
                          title="not enriched yet: no interests or search terms"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                          </svg>
                        </span>
                      )}
                      <button
                        type="button"
                        className="resume-row__view"
                        aria-label={`View ${resume.file_name}`}
                        title="view this resume"
                        onClick={() => void viewResume(resume.resume_id)}
                        disabled={viewing !== null || uploading}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`resume-row__check ${isSelected ? 'resume-row__check--on' : ''}`}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`Use ${resume.file_name}`}
                        title={isEnriched ? undefined : 'add interests to this resume before making it primary'}
                        onClick={() => !isSelected && void selectResume(resume.resume_id)}
                        disabled={!isEnriched || selecting !== null || viewing !== null || uploading}
                      >
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    </span>
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
        )}

        {error && <p className="resume-error">{error}</p>}
      </div>

      {viewer && (
        <div
          className="resume-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={viewer.fileName || 'resume'}
          onClick={() => setViewer(null)}
        >
          <div className="resume-viewer__panel" onClick={(event) => event.stopPropagation()}>
            <div className="resume-viewer__bar">
              <span className="resume-viewer__name">{viewer.fileName}</span>
              <button
                type="button"
                className="resume-viewer__close"
                aria-label="Close resume"
                onClick={() => setViewer(null)}
              >
                ×
              </button>
            </div>
            <PdfViewer url={viewer.url} />
          </div>
        </div>
      )}
    </div>
  )
}
