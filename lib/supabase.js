import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// The project URL must look like https://xxxxxxxx.supabase.co. The login screen shows a clear
// message when it doesn't, instead of failing silently.
export const configOk = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url) && key.length > 40;

export const supabase = createClient(configOk ? url : 'https://placeholder.supabase.co', configOk ? key : 'placeholder-key-placeholder-key-placeholder', {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
