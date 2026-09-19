import { buildTaskKey, withTitleSuffix } from "../automationHelpers"
import type { EmployerInstruction } from "../automationHelpers"
import { api } from "../../../lib/api"
import { addLog } from "../automationStore"

// Task keys already on the server, so a run doesn't recreate a task it has already
// raised for this application. Owned here rather than by the run: it is replaced
// wholesale in two places, and an imported binding cannot be reassigned.
let existingTasks = new Set<string>()

export const setExistingTasks = (keys: Iterable<string>) => {
  existingTasks = new Set(keys)
}

export const createDocumentTask = async (
  text: string,
  description: string,
  userId: string,
  applicationId?: string | null
) => {
  const key = buildTaskKey(text, applicationId)
  if (existingTasks.has(key)) return
  const resp = await api.post(`/tasks/${userId}/new`, { text, description, application_id: applicationId ?? undefined })
  if (!resp.ok) {
    addLog('Error occured while creating task.')
    return
  }
  existingTasks.add(key)
}

export const addEmployerTasks = async (
  instructions: EmployerInstruction[],
  userId: string,
  applicationId?: string | null,
  jobTitle?: string
) => {
  const tasks = instructions.filter(inst => inst.text && inst.description)
  if (!tasks.length) return

  const results = await Promise.allSettled(
    tasks.map(async ({ text, description }) => {
      const key = buildTaskKey(text, applicationId)
      if (!key || existingTasks.has(key)) return

      const resp = await api.post(`/tasks/${userId}/new`, {
        text,
        description: withTitleSuffix(jobTitle, description || text),
        application_id: applicationId ?? undefined
      })
      if (!resp.ok) {
        const msg = await resp.text().catch(() => '')
        throw new Error(`status ${resp.status} ${msg}`)
      }
      existingTasks.add(key)
    })
  )

  if (results.some(result => result.status === 'rejected')) {
    addLog('Error occured.')
  }
}

export const clearTasksForApplication = async (userId: string, applicationId: string) => {
  try {
    await api.del(`/tasks/${userId}/application/${applicationId}`)
    existingTasks = new Set(
      Array.from(existingTasks).filter(key => !key.startsWith(`${applicationId}::`))
    )
  } catch (_err) {
    addLog('Unable to clear existing tasks for this application.')
  }
}
