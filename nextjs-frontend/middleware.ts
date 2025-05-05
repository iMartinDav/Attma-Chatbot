import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import { defaultLocale, locales } from './lib/internationalization/config';

// List of paths that don't need i18n handling
const publicRoutes = [
  '/api',
  '/_next',
  '/images',
  '/fonts',
  '/favicon.ico',
  '/sw.js',
  '/manifest.json',
];

// Auth routes that should not be localized
const authRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// App routes that should not be localized but need auth
const nonLocalizedAppRoutes = ['/chat', '/settings'];

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

// Simple in-memory rate limiting store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

function getLocaleFromRequest(request: NextRequest): string {
  // Negotiator expects plain object so we need to transform headers
  const negotiatorHeaders: Record<string, string> = {};
  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
  request.headers.forEach((value, key) => (negotiatorHeaders[key] = value));

  // Use negotiator and intl-localematcher to get best locale
  try {
    const languages = new Negotiator({
      headers: negotiatorHeaders,
    }).languages();
    return match(languages, locales, defaultLocale);
  } catch (error) {
    return defaultLocale;
  }
}

// Check if the user is authenticated based on cookies
function isAuthenticated(request: NextRequest): boolean {
  // Check for session token in cookies
  const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value;
  
  return !!sessionToken;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // First, check if this is a non-localized app route (like /chat, /settings)
  const isNonLocalizedAppRoute = nonLocalizedAppRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isNonLocalizedAppRoute) {
    // Perform auth check for these routes
    if (!isAuthenticated(request)) {
      // Redirect to login page
      const url = new URL('/login', request.url);
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Check if this is a localized version of a non-localized app route (like /es/chat)
  // and redirect to the non-localized version
  for (const locale of locales) {
    for (const route of nonLocalizedAppRoutes) {
      if (
        pathname === `/${locale}${route}` ||
        pathname.startsWith(`/${locale}${route}/`)
      ) {
        // Get the path after the locale and route
        const restOfPath =
          pathname.substring(`/${locale}${route}`.length) || '';
        const url = new URL(`${route}${restOfPath}`, request.url);

        // Preserve any query parameters
        for (const [key, value] of request.nextUrl.searchParams.entries()) {
          url.searchParams.set(key, value);
        }

        return NextResponse.redirect(url);
      }
    }
  }

  // Apply rate limiting for authentication endpoints
  if (pathname.startsWith('/api/auth')) {
    const now = Date.now();

    // Use headers to identify clients
    const clientId =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Clean up old entries
    for (const [key, data] of rateLimitStore.entries()) {
      if (now - data.timestamp > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(key);
      }
    }

    // Check rate limit for this client
    const rateData = rateLimitStore.get(clientId) || {
      count: 0,
      timestamp: now,
    };

    if (now - rateData.timestamp <= RATE_LIMIT_WINDOW) {
      if (rateData.count >= MAX_REQUESTS_PER_WINDOW) {
        return new NextResponse('Too many requests', { status: 429 });
      }
      rateData.count++;
    } else {
      rateData.count = 1;
      rateData.timestamp = now;
    }

    rateLimitStore.set(clientId, rateData);
  }

  // Handle direct auth routes without localization
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next(); // Let Next.js handle these routes directly
  }

  // Skip locale handling for public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    // For API routes that need auth, check auth
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
      if (!isAuthenticated(request)) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    return NextResponse.next();
  }

  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // If path has no locale and isn't a special route, add locale
  const locale = getLocaleFromRequest(request);
  const newUrl = new URL(request.url);
  newUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: [
    // Skip all internal paths but include all pages
    '/((?!api|_next/static|_next/image|images|fonts|favicon.ico).*)',
    // Also use the middleware for protected routes
    '/chat',
    '/chat/:path*',
    '/settings',
    '/settings/:path*',
    '/api/((?!auth).*)',
    '/api/auth/:path*',
  ],
};
