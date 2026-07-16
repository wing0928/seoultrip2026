import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
export const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
).trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabaseSyncFunctionUrl = String(
  import.meta.env.VITE_SUPABASE_SYNC_FUNCTION_URL || (supabaseUrl ? `${supabaseUrl}/functions/v1/trip-sync` : '')
).trim();

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null;
