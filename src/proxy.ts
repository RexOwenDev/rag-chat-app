import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Only update the outgoing response cookies.
          // auth.getUser() runs before setAll, so this request's session
          // is already read from getAll() above — no request mutation needed.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              sameSite: 'lax', // enforce minimum; auth cookies must not be cross-site
            })
          );
        },
      },
    }
  );

  // Refresh session — must happen before any route checks
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes: workspace routes require auth
  const isProtected =
    pathname === '/workspaces' ||
    pathname.startsWith('/workspaces/');

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // If logged in and hitting /login, redirect to workspaces
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/workspaces', request.url));
  }

  // Security headers on all responses
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  return supabaseResponse;
}

// Next.js 16 proxy.ts requires Node.js runtime (not Edge)
export const runtime = 'nodejs';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/auth|api/inngest).*)'],
};
