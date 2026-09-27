import { toBool } from './automationHelpers'
import { loadCandidateContext } from './candidateContext'

let waitForApprovalPref = true
let recentJobsPref = true
let unpaidRolesPref = false
let preferencesLoaded = false

/** Fetched once per session; returns the approval preference the caller usually wants. */
export async function loadUserPreferences() {
  if (preferencesLoaded) return waitForApprovalPref
  const result = await loadCandidateContext()
  if (result.ok) {
    const prefs = result.context.preferences
    waitForApprovalPref = toBool(prefs?.wait_for_approval, true)
    recentJobsPref = toBool(prefs?.recent_jobs, true)
    unpaidRolesPref = toBool(prefs?.unpaid_roles, false)
  }
  preferencesLoaded = true
  return waitForApprovalPref
}

export const prefersRecentJobs = () => recentJobsPref

export const allowsUnpaidRoles = () => unpaidRolesPref
