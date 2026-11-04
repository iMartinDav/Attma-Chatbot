import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
const nonLocalizedAppRoutes = ['/chat', '/settings', '/console'];

function getLocaleFromRequest(request: NextRequest): string {
  // Negotiator expects plain object so we need to transform headers
  const negotiatorHeaders: Record<string, string> = {};
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

// attma.bio is the main Attma product. Until its domain moves to that Vercel
// project, requests for it reach this app and are sent to the main landing.
const MAIN_APP_HOSTS = new Set(['attma.bio', 'www.attma.bio']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (MAIN_APP_HOSTS.has(request.headers.get('host') ?? '')) {
    return NextResponse.redirect(
      new URL(`${pathname}${request.nextUrl.search}`, 'https://app.attma.bio'),
      307,
    );
  }

  // First, check if this is a non-localized app route (like /chat, /settings)
  const isNonLocalizedAppRoute = nonLocalizedAppRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isNonLocalizedAppRoute) {
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

  // Handle direct auth routes without localization
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next(); // Let Next.js handle these routes directly
  }

  // Skip locale handling for public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
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
    // Skip internal paths and static files (anything with an extension, such
    // as /demo/synthetic-exome-report.pdf); include all pages
    '/((?!api|_next/static|_next/image|images|fonts|demo|favicon.ico|.*\\..*).*)',
  ],
};
