import { getUserId } from '../../../lib/supabase'
import { api } from '../../../lib/api'
import { loadCandidateContext } from './candidateContext'
import { addLog, getState, setState } from './automationStore'
import { setExistingTasks } from '../symplicity/tasks'

const refreshExistingTasks = async () => {
  try {
    const tasksResp = await api.get('/me/tasks')
    if (!tasksResp.ok) return
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
  } catch (_err) {
    // ignore
  }
}

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
    // Polls only need the search terms: the task index is a run-start concern.
    if (!isPoll) await refreshExistingTasks()

    const result = await loadCandidateContext(isPoll)
    if (!result.ok) {
      if (!isPoll) {
        addLog(result.status === 404
          ? 'No resume found. Retrying...'
          : 'Error occured. Could not fetch search terms. Retrying...')
      }
      return
    }

    const terms: string[] = Array.isArray(result.context.resume?.search_terms)
      ? result.context.resume.search_terms
      : []
    const ready = terms.length > 0
    const current = getState()
    if (current.searchTermsReady === ready && current.searchTerms.join('\u0000') === terms.join('\u0000')) return
    setState({ searchTerms: terms, searchTermsReady: ready })
  } catch (_error) {
    if (!isPoll) addLog('Error occured. Could not get search terms.')
  }
}

