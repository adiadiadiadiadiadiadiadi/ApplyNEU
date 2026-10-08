import { mutationOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { releaseErrorRedirect, suppressErrorRedirect } from '../lib/fetchErrorControl'

export type Profile = {
  user_id: string
  first_name: string
  last_name: string
  grad_year: number
}

export type ProfileChanges = Partial<Pick<Profile, 'first_name' | 'last_name' | 'grad_year'>>

export type JobMatch = 'low' | 'medium' | 'high'

export type Preferences = {
  wait_for_approval: boolean
  recent_jobs: boolean
  job_match: JobMatch
  unpaid_roles: boolean
  email_notifications: boolean
  interests: string[]
}

export type PreferenceChanges = Partial<Omit<Preferences, 'interests'>>

export type PrimaryResume = {
  resume_id: string
  file_name: string
  created_at?: string
}

export const settingsKeys = {
  profile: ['profile'] as const,
  preferences: ['preferences'] as const,
  resumes: ['resumes'] as const,
  resumeList: ['resumes', 'list'] as const,
  primaryResume: ['resumes', 'primary'] as const,
  interestOptions: ['interests'] as const,
}

const getJson = async <T>(path: string): Promise<T> => {
  const resp = await api.get(path)
  if (!resp.ok) throw new Error(`GET ${path} failed with ${resp.status}`)
  return resp.json() as Promise<T>
}

// The caller shows its own inline error, so a failed save must not become the /error page.
const putSuppressed = async <T>(key: string, path: string, body: unknown): Promise<T> => {
  suppressErrorRedirect(key)
  try {
    const resp = await api.put(path, body)
    if (!resp.ok) throw new Error(`PUT ${path} failed with ${resp.status}`)
    return resp.json() as Promise<T>
  } finally {
    releaseErrorRedirect(key)
  }
}

const toJobMatch = (value: unknown): JobMatch => {
  const raw = String(value ?? '').toLowerCase()
  return raw === 'high' || raw === 'low' ? raw : 'medium'
}

const toPreferences = (row: Record<string, unknown>): Preferences => ({
  wait_for_approval: row.wait_for_approval !== false,
  recent_jobs: row.recent_jobs !== false,
  job_match: toJobMatch(row.job_match),
  unpaid_roles: row.unpaid_roles === true,
  email_notifications: row.email_notifications !== false,
  interests: Array.isArray(row.interests) ? row.interests.map(String) : [],
})

export const useProfile = () =>
  useQuery({
    queryKey: settingsKeys.profile,
    queryFn: () => getJson<Profile>('/me'),
  })

export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (changes: ProfileChanges) => putSuppressed<Profile>('profile-save', '/me', changes),
    onSuccess: (profile) => {
      queryClient.setQueryData(settingsKeys.profile, profile)
    },
  })
}

export const usePreferences = () =>
  useQuery({
    queryKey: settingsKeys.preferences,
    queryFn: async () => toPreferences(await getJson<Record<string, unknown>>('/me/preferences')),
  })

const PREFERENCES_MUTATION = ['preferences', 'update'] as const

// Saves share a scope so they reach the server in click order, which makes the last
// click win. The cache is only refetched once the final queued save settles, so an
// earlier response can't briefly overwrite a later optimistic value.
export const preferencesMutationOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationKey: PREFERENCES_MUTATION,
    scope: { id: 'preferences' },
    mutationFn: (changes: PreferenceChanges) =>
      putSuppressed<Record<string, unknown>>('preferences-save', '/me/preferences', changes),
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.preferences })
      const previous = queryClient.getQueryData<Preferences>(settingsKeys.preferences)
      queryClient.setQueryData<Preferences>(settingsKeys.preferences, (current) =>
        current ? { ...current, ...changes } : current,
      )
      return { previous }
    },
    onError: (_error, changes, context) => {
      const previous = context?.previous
      if (!previous) return
      const reverted = Object.fromEntries(
        Object.keys(changes).map((key) => [key, previous[key as keyof PreferenceChanges]]),
      )
      queryClient.setQueryData<Preferences>(settingsKeys.preferences, (current) =>
        current ? { ...current, ...reverted } : current,
      )
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: PREFERENCES_MUTATION }) === 1) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.preferences })
      }
    },
  })

export const useUpdatePreferences = () => {
  const queryClient = useQueryClient()
  return useMutation(preferencesMutationOptions(queryClient))
}

export const usePrimaryResume = () =>
  useQuery({
    queryKey: settingsKeys.primaryResume,
    queryFn: () => getJson<PrimaryResume | null>('/me/resumes/primary'),
  })

export const useInterestOptions = () =>
  useQuery({
    queryKey: settingsKeys.interestOptions,
    queryFn: () => getJson<string[]>('/interests'),
    staleTime: Infinity,
  })

export const useSaveInterests = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (interests: string[]) =>
      putSuppressed('interests-save', '/me/preferences/interests', { interests }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.preferences }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.resumes }),
      ]),
  })
}
