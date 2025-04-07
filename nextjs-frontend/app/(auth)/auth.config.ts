import type { NextAuthConfig } from 'next-auth';
import { locales } from '@/lib/internationalization/config';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
    verifyRequest: '/verify-request',
    newUser: '/register',
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Extract path without locale if present
      const pathname = nextUrl.pathname;
      const pathWithoutLocale = locales.some((locale) =>
        pathname.startsWith(`/${locale}/`),
      )
        ? `/${pathname.split('/').slice(2).join('/')}`
        : pathname;

      // More comprehensive protected routes list
      const isProtectedRoute = [
        '/chat',
        '/settings',
        '/documents',
        '/profile',
      ].some(
        (route) =>
          pathWithoutLocale === route ||
          pathWithoutLocale.startsWith(`${route}/`),
      );

      if (isProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
