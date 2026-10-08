import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { suppressErrorRedirect, releaseErrorRedirect } from '../../lib/fetchErrorControl'
import { settingsKeys } from '../../queries/settings'
import ComponentLoader from '../common/ComponentLoader'
import PdfViewer from '../common/PdfViewer'
import ResumeMenu from './resumeMenu'
import './settings.css'

type EnrichmentStatus = 'none' | 'pending' | 'failed' | 'complete'

type ResumeRow = {
  resume_id: string
  file_name: string
  created_at?: string
  upload_complete?: boolean
  is_primary?: boolean
  enrichment_status?: EnrichmentStatus
  can_retry?: boolean
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
const RETRY_SUPPRESSOR = 'resumes-retry'
const DELETE_SUPPRESSOR = 'resumes-delete'
const POLL_INTERVAL_MS = 3000

// The list is the source of truth; /primary only covers the list call erroring
// out, so an empty list stays empty rather than resurfacing a resume the filter
// below deliberately dropped. Suppressed so a 404 cannot trip the global
// interceptor into replacing this screen with the /error page.
const fetchResumes = async (): Promise<ResumeRow[]> => {
  suppressErrorRedirect(LIST_SUPPRESSOR)
  try {
    const listResp = await api.get('/me/resumes')
    if (listResp.ok) {
      const rows = await listResp.json()
      return Array.isArray(rows) ? rows.filter((row: ResumeRow) => row.upload_complete !== false) : []
    }

    const primaryResp = await api.get('/me/resumes/primary')
    if (!primaryResp.ok) throw new Error('Could not load resumes')
    const primary = await primaryResp.json()
    if (!primary?.resume_id) return []
    return [{
      resume_id: primary.resume_id,
      file_name: primary.file_name ?? '',
      created_at: primary.created_at,
      is_primary: true,
    }]
  } finally {
    releaseErrorRedirect(LIST_SUPPRESSOR)
  }
}

export default function Resumes() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const resumesQuery = useQuery({
    queryKey: settingsKeys.resumeList,
    queryFn: fetchResumes,
    refetchInterval: (query) =>
      query.state.data?.some((row) => row.enrichment_status === 'pending') ? POLL_INTERVAL_MS : false,
  })
  const savedResumes = resumesQuery.data ?? []
  const [uploadingRow, setUploadingRow] = useState<ResumeRow | null>(null)
  const resumes = uploadingRow ? [uploadingRow, ...savedResumes] : savedResumes
  const selectedId = (savedResumes.find((row) => row.is_primary) ?? savedResumes[0])?.resume_id ?? ''
  const [selecting, setSelecting] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<ResumeRow | null>(null)
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
    if (!confirmingDelete) return
    const onKey = ({ key }: { key: string }) => {
      if (key === 'Escape') setConfirmingDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmingDelete])

  const updateResumes = (update: (rows: ResumeRow[]) => ResumeRow[]) => {
    queryClient.setQueryData<ResumeRow[]>(settingsKeys.resumeList, (rows) => rows && update(rows))
  }

  const retryEnrichment = async (resumeId: string) => {
    if (retrying) return
    setRetrying(resumeId)
    setError(null)
    suppressErrorRedirect(RETRY_SUPPRESSOR)
    try {
      const resp = await api.post(`/resumes/${resumeId}/enrichment/retry`, {})
      if (resp.status === 429) {
        updateResumes((rows) =>
          rows.map((row) => (row.resume_id === resumeId ? { ...row, can_retry: false } : row))
        )
        return
      }
      if (!resp.ok && resp.status !== 409) {
        throw new Error('Could not retry enrichment')
      }
      updateResumes((rows) =>
        rows.map((row) =>
          row.resume_id === resumeId ? { ...row, enrichment_status: 'pending' } : row
        )
      )
    } catch (err) {
      console.error('Failed retrying enrichment', err)
      setError('Could not retry generating search terms. Please try again.')
    } finally {
      releaseErrorRedirect(RETRY_SUPPRESSOR)
      setRetrying(null)
    }
  }

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
    setSelecting(resumeId)
    await queryClient.cancelQueries({ queryKey: settingsKeys.resumeList })
    const previous = queryClient.getQueryData<ResumeRow[]>(settingsKeys.resumeList)
    updateResumes((rows) => rows.map((row) => ({ ...row, is_primary: row.resume_id === resumeId })))
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
      queryClient.setQueryData(settingsKeys.resumeList, previous)
      setError('Could not switch resumes. Please try again.')
    } finally {
      releaseErrorRedirect(SELECT_SUPPRESSOR)
      setSelecting(null)
      void queryClient.invalidateQueries({ queryKey: settingsKeys.resumes })
    }
  }

  // When the primary is deleted the server falls back to the newest remaining resume,
  // which is the first row since the list is newest first.
  const deleteResume = async (resumeId: string) => {
    if (deleting || uploading) return
    setDeleting(resumeId)
    setError(null)
    suppressErrorRedirect(DELETE_SUPPRESSOR)
    try {
      const resp = await api.del(`/me/resumes/${resumeId}`)
      if (!resp.ok && resp.status !== 404) {
        throw new Error('Could not delete resume')
      }
      updateResumes((rows) => {
        const remaining = rows.filter((row) => row.resume_id !== resumeId)
        return selectedId === resumeId
          ? remaining.map((row, index) => ({ ...row, is_primary: index === 0 }))
          : remaining
      })
    } catch (err) {
      console.error('Failed deleting resume', err)
      setError('Could not delete resume. Please try again.')
    } finally {
      releaseErrorRedirect(DELETE_SUPPRESSOR)
      setDeleting(null)
      void queryClient.invalidateQueries({ queryKey: settingsKeys.resumes })
    }
  }

  const uploadResume = async (file: File) => {
    if (uploading) return
    setUploading(true)
    setError(null)
    setUploadingRow({
      resume_id: `uploading-${Date.now()}`,
      file_name: file.name,
      created_at: new Date().toISOString(),
      enrichment_status: 'pending',
    })

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

      const saved: ResumeRow = await saveResp.json()
      updateResumes((rows) => [
        {
          resume_id: saved.resume_id,
          file_name: file.name,
          created_at: saved.created_at ?? new Date().toISOString(),
          upload_complete: true,
          enrichment_status: saved.enrichment_status ?? 'pending',
        },
        ...rows,
      ])
    } catch (err) {
      console.error('Resume upload failed', err)
      setError('Could not upload resume. Please try again.')
    } finally {
      setUploadingRow(null)
      setUploading(false)
      void queryClient.invalidateQueries({ queryKey: settingsKeys.resumes })
    }
  }

  return (
    <div className="settings-page page-stagger">
      <div className={`settings-inner stagger-children${resumesQuery.isPending ? ' settings-inner--loading' : ''}`}>
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

        {resumesQuery.isPending ? (
          <ComponentLoader fullPage label="loading resumes" />
        ) : (
          <div className="settings-card resume-card">
            <ul className="resume-list" aria-label="resumes">
              {resumes.map((resume) => {
                const isSelected = resume.resume_id === selectedId
                const enrichment = resume.enrichment_status ?? 'complete'
                const isEnriched = enrichment === 'complete'
                const needsRetry = enrichment === 'failed' || enrichment === 'none'
                const retriesExhausted = needsRetry && resume.can_retry === false
                return (
                  <li
                    key={resume.resume_id}
                    className={`resume-row ${isSelected ? 'resume-row--selected' : ''}`}
                  >
                    <span className="resume-row__meta">
                      <span className="resume-row__title">
                        <span className="resume-row__name">{resume.file_name}</span>
                        {isSelected && <span className="resume-row__badge">primary</span>}
                      </span>
                      {formatUploadDate(resume.created_at) && (
                        <span className="resume-row__date">
                          uploaded {formatUploadDate(resume.created_at)}
                        </span>
                      )}
                    </span>
                    <span className="resume-row__actions">
                      {enrichment === 'pending' && (
                        <span
                          className="resume-row__pending"
                          role="status"
                          aria-label="Generating search terms"
                          title="generating search terms"
                        />
                      )}
                      {needsRetry && !retriesExhausted && (
                        <button
                          type="button"
                          className="resume-row__retry"
                          aria-label={`Retry generating search terms for ${resume.file_name}`}
                          title={enrichment === 'none' ? 'search terms were never generated, retry' : 'generating search terms failed, retry'}
                          onClick={() => void retryEnrichment(resume.resume_id)}
                          disabled={retrying !== null || uploading}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        </button>
                      )}
                      {retriesExhausted && (
                        <span
                          className="resume-row__warn"
                          role="img"
                          aria-label="Internal server error. Please try again later."
                          title="internal server error. please try again later."
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                          </svg>
                        </span>
                      )}
                      <ResumeMenu
                        fileName={resume.file_name}
                        disabled={uploading || deleting === resume.resume_id}
                        items={[
                          {
                            label: 'View',
                            onSelect: () => void viewResume(resume.resume_id),
                            disabled: viewing !== null,
                          },
                          ...(isSelected
                            ? []
                            : [{
                                label: 'Make primary',
                                onSelect: () => void selectResume(resume.resume_id),
                                disabled: !isEnriched || selecting !== null || viewing !== null,
                                hint:
                                  enrichment === 'pending'
                                    ? 'still generating search terms for this resume'
                                    : needsRetry
                                      ? 'retry generating search terms before making this resume primary'
                                      : undefined,
                              }]),
                          {
                            label: 'Delete',
                            onSelect: () => setConfirmingDelete(resume),
                            disabled: deleting !== null || selecting !== null,
                          },
                        ]}
                      />
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
                  +
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

        {(error || resumesQuery.isError) && (
          <p className="resume-error">{error ?? 'Could not load resumes. Please try again.'}</p>
        )}
      </div>

      {confirmingDelete && (
        <div
          className="resume-viewer"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="resume-confirm-title"
          onClick={() => setConfirmingDelete(null)}
        >
          <div className="resume-confirm" onClick={(event) => event.stopPropagation()}>
            <p id="resume-confirm-title" className="resume-confirm__title">delete this resume?</p>
            <p className="resume-confirm__name">{confirmingDelete.file_name}</p>
            <div className="resume-confirm__actions">
              <button
                type="button"
                className="resume-confirm__btn"
                onClick={() => setConfirmingDelete(null)}
                autoFocus
              >
                cancel
              </button>
              <button
                type="button"
                className="resume-confirm__btn resume-confirm__btn--danger"
                onClick={() => {
                  const { resume_id } = confirmingDelete
                  setConfirmingDelete(null)
                  void deleteResume(resume_id)
                }}
              >
                delete
              </button>
            </div>
          </div>
        </div>
      )}

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
