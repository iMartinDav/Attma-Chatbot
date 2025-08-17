import { NextRequest, NextResponse } from "next/server"
import { auth } from "./app/(auth)/auth"

export default async function authMiddleware(req: NextRequest) {
  // Get the session
  const session = await auth()
  
  // Check if the route requires auth
  const { pathname } = req.nextUrl
  
  // Public routes that don't need auth
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/api/auth',
  ]
  
  // Check if it's a public route or has locale prefix
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || 
    pathname.startsWith(route + '/') ||
    /^\/[a-z]{2}(-[A-Z]{2})?($|\/)/.test(pathname) // locale pattern
  )
  
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
  // For protected routes, require a valid session
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
