import { buildTaskKey, withTitleSuffix } from "../work/automationHelpers"
import type { EmployerInstruction } from "../work/automationHelpers"
import { api } from "../../../lib/api"
import { addLog } from "../work/automationStore"

let existingTasks = new Set<string>()

export const setExistingTasks = (keys: Iterable<string>) => {
  existingTasks = new Set(keys)
}

export const createDocumentTask = async (
  text: string,
  description: string,
  applicationId?: string | null
) => {
  const key = buildTaskKey(text, applicationId)
  if (existingTasks.has(key)) return
  const resp = await api.post('/me/tasks/new', { text, description, application_id: applicationId ?? undefined })
  if (!resp.ok) {
    addLog('Error occured while creating task.')
    return
  }
  existingTasks.add(key)
}

export const addEmployerTasks = async (
  instructions: EmployerInstruction[],
  applicationId?: string | null,
  jobTitle?: string
) => {
  const tasks = instructions.filter(inst => inst.text && inst.description)
  if (!tasks.length) return

  const results = await Promise.allSettled(
    tasks.map(async ({ text, description }) => {
      const key = buildTaskKey(text, applicationId)
      if (!key || existingTasks.has(key)) return

      const resp = await api.post('/me/tasks/new', {
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

export const clearTasksForApplication = async (applicationId: string) => {
  try {
    await api.del(`/me/tasks/application/${applicationId}`)
    existingTasks = new Set(
      Array.from(existingTasks).filter(key => !key.startsWith(`${applicationId}::`))
    )
  } catch (_err) {
    addLog('Unable to clear existing tasks for this application.')
  }
}
