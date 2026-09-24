import { toBool } from './automationHelpers'
import { getUserId } from '../../../lib/supabase'
import { api } from '../../../lib/api'

let waitForApprovalPref = true
let recentJobsPref = true
let unpaidRolesPref = false
let preferencesLoaded = false

/** Fetched once per session; returns the approval preference the caller usually wants. */
export async function loadUserPreferences() {
  if (preferencesLoaded) return waitForApprovalPref
  const userId = await getUserId()
  if (!userId) return waitForApprovalPref
  try {
    const resp = await api.get('/me/preferences')
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}))
      waitForApprovalPref = toBool(data.wait_for_approval ?? data.waitForApproval, true)
      recentJobsPref = toBool(data.recent_jobs ?? data.recentJobs, true)
      unpaidRolesPref = toBool(data.unpaid_roles ?? data.upaid_roles, false)
    }
  } catch (_err) {
    // ignore preference fetch errors
  } finally {
    preferencesLoaded = true
  }
  return waitForApprovalPref
}

export const prefersRecentJobs = () => recentJobsPref

export const allowsUnpaidRoles = () => unpaidRolesPref
