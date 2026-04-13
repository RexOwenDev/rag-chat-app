import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Root page — server-side auth check then redirect.
 *
 * Authenticated  → /workspaces  (AppShell handles workspace selection)
 * Unauthenticated → /login
 *
 * Never renders visible UI — this is purely a navigation gate.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/workspaces');
  } else {
    redirect('/login');
  }
}
