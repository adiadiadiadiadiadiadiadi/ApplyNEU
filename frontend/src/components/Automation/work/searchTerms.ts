import { getUserId } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { addLog, setState } from './automationStore'
import { setExistingTasks } from '../symplicity/tasks'

/**
 * Search terms plus the existing-task index a run dedupes against. The screen owns
 * the polling; the data lives here because a run keeps using it once the screen is
 * gone.
 */
export const refreshSearchTerms = async (isPoll = false) => {
  try {
    const userId = await getUserId()
    if (!userId) {
      if (!isPoll) addLog('Error occured: no user found. Retrying...')
      return
    }
    try {
      const tasksResp = await api.get('/me/tasks')
      if (tasksResp.ok) {
        const tasksData = await tasksResp.json().catch(() => [])
        const taskKeys = Array.isArray(tasksData)
          ? tasksData
              .map((t: any) => {
                const text = String(t?.text ?? '').trim()
                const appId = t?.application_id ? String(t.application_id) : 'global'
                if (!text) return null
                return `${appId}::${text.toLowerCase()}`
              })
              .filter(Boolean) as string[]
          : []
        setExistingTasks(taskKeys)
      }
    } catch (_err) {
      // ignore
    }

    const latestResumeResp = await api.get('/me/resumes/latest')
    if (!latestResumeResp.ok) { if (!isPoll) addLog('Error occured. Could not fetch resume. Retrying...'); return; }
    const latestResume = await latestResumeResp.json()
    const resumeId = latestResume?.resume_id
    if (!resumeId) { if (!isPoll) addLog('No resume found. Retrying...'); return; }

    const response = await api.get(`/resumes/${resumeId}/search-terms`)
    if (!response.ok) { if (!isPoll) addLog('Error occured. Could not fetch search terms. Retrying...'); return; }

    const data = await response.json()
    const terms = Array.isArray(data?.search_terms) ? data.search_terms : []
    // Enrichment is async: an empty list means the worker hasn't written search
    // terms yet, so the screen stays "not ready" and automation stays disabled.
    setState({ searchTerms: terms, searchTermsReady: terms.length > 0 })
  } catch (_error) {
    if (!isPoll) addLog('Error occured. Could not get search terms.')
  }
}

