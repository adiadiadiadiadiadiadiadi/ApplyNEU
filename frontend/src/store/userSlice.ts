import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { supabase } from '../lib/supabase'

type UserProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  gradYear: string
  waitForApproval: boolean
  recent_jobs: boolean
  job_match: 'low' | 'medium' | 'high'
  unpaid_roles: boolean
  email_notifications: boolean
}

type UserState = {
  profile: UserProfile | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
}

const initialState: UserState = {
  profile: null,
  status: 'idle',
  error: null,
}

const toBool = (value: unknown, fallback = true) =>
  value === undefined || value === null ? fallback : value === true || value === 'true'

type PreferencePayload = Partial<
  Pick<UserProfile, 'waitForApproval' | 'recent_jobs' | 'job_match' | 'unpaid_roles' | 'email_notifications'>
>

export const fetchUserProfile = createAsyncThunk<UserProfile, void, { rejectValue: string }>(
  'user/fetchProfile',
  async (_arg, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        return rejectWithValue('Not authenticated')
      }

      const user = data.user
      const response = await fetch(`http://localhost:8080/users/${user.id}`)

      if (!response.ok) {
        let backendMessage = 'failed to fetch profile from backend'
        try {
          const body = await response.json()
          backendMessage = body?.message ? String(body.message) : backendMessage
        } catch {
          try {
            backendMessage = (await response.text()) || backendMessage
          } catch {
            // ignore and keep fallback
          }
        }
        return rejectWithValue(
          `failed to fetch profile for user ${user.id}: ${response.status} ${backendMessage}`
        )
      }

      const userRow = await response.json()
      const jobMatchRaw = (userRow.job_match ?? 'medium').toString().toLowerCase()
      const job_match: UserProfile['job_match'] =
        jobMatchRaw === 'high' ? 'high' : jobMatchRaw === 'low' ? 'low' : 'medium'

      return {
        id: user.id,
        firstName: (userRow.first_name ?? '').toString(),
        lastName: (userRow.last_name ?? '').toString(),
        email: (userRow.email ?? user.email ?? '').toString(),
        gradYear: (userRow.grad_year ?? '').toString(),
        waitForApproval: toBool(userRow.wait_for_approval ?? userRow.waitForApproval, true),
        recent_jobs: toBool(userRow.recent_jobs ?? userRow.recentJobs, true),
        job_match,
        unpaid_roles: toBool(userRow.unpaid_roles ?? userRow.upaid_roles, false),
        email_notifications: toBool(
          userRow.email_notifications ?? userRow.email_notificatios ?? userRow.emailNotifications,
          true
        ),
      }
    } catch (err) {
      console.error('fetchUserProfile failed', err)
      return rejectWithValue('Failed to load user')
    }
  },
)

export const saveUserPreferences = createAsyncThunk<
  PreferencePayload,
  PreferencePayload,
  { state: { user: UserState }; rejectValue: string }
>('user/savePreferences', async (prefs, { getState, rejectWithValue }) => {
  const userId = getState().user.profile?.id
  if (!userId) return rejectWithValue('No user loaded')

  try {
    const response = await fetch(`http://localhost:8080/users/${userId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wait_for_approval: prefs.waitForApproval,
        recent_jobs: prefs.recent_jobs,
        job_match: prefs.job_match,
        unpaid_roles: prefs.unpaid_roles,
        email_notifications: prefs.email_notifications,
      }),
    })

    if (!response.ok) {
      return rejectWithValue('Failed to save preferences')
    }

    const data = await response.json()
    const jobMatchRaw = (data.job_match ?? 'medium').toString().toLowerCase()
    const job_match: UserProfile['job_match'] =
      jobMatchRaw === 'high' ? 'high' : jobMatchRaw === 'low' ? 'low' : 'medium'

    return {
      waitForApproval: toBool(data.wait_for_approval ?? data.waitForApproval, true),
      recent_jobs: toBool(data.recent_jobs ?? data.recentJobs, true),
      job_match,
      unpaid_roles: toBool(data.unpaid_roles ?? data.upaid_roles, false),
      email_notifications: toBool(
        data.email_notifications ?? data.email_notificatios ?? data.emailNotifications,
        true
      ),
    }
  } catch (err) {
    console.error('saveUserPreferences failed', err)
    return rejectWithValue('Failed to save preferences')
  }
})

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setPreferences: (state, action: { payload: PreferencePayload }) => {
      if (!state.profile) return
      state.profile = { ...state.profile, ...action.payload }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.profile = action.payload
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? 'Failed to load user'
      })
      .addCase(saveUserPreferences.fulfilled, (state, action) => {
        if (!state.profile) return
        state.profile = { ...state.profile, ...action.payload }
      })
  },
})

export const { setPreferences } = userSlice.actions
export default userSlice.reducer
