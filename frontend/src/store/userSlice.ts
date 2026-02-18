import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { supabase } from '../lib/supabase'

type UserProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  gradYear: string
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
        return rejectWithValue('Failed to fetch profile from backend')
      }

      const userRow = await response.json()
      return {
        id: user.id,
        firstName: (userRow.first_name ?? '').toString(),
        lastName: (userRow.last_name ?? '').toString(),
        email: (userRow.email ?? user.email ?? '').toString(),
        gradYear: (userRow.grad_year ?? '').toString(),
      }
    } catch (err) {
      console.error('fetchUserProfile failed', err)
      return rejectWithValue('Failed to load user')
    }
  },
)

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
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
  },
})

export default userSlice.reducer
