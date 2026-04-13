/**
 * Service-role Supabase client for Inngest background jobs.
 * NEVER import this in route handlers or components — use server.ts instead.
 * Uses SERVICE_ROLE_KEY which bypasses RLS — only safe in trusted server contexts.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let _serviceClient: ReturnType<typeof createSupabaseClient> | null = null;

export function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        // No db override needed — 'public' schema is the default
      }
    );
  }
  return _serviceClient;
}
