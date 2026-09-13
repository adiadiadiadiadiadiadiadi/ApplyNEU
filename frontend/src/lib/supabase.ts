import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id
}

export const getAccessToken = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}


