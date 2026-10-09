import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

/**
 * Server-only Supabase Client using the privileged Service Role Key.
 *
 * CRITICAL SECURITY INVARIANT:
 * This module MUST NEVER be imported by client-side browser bundles.
 */
export function getSupabaseServerAdmin(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'FATAL SECURITY VIOLATION: getSupabaseServerAdmin was invoked in a client/browser environment.'
    );
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY server environment variables.'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
