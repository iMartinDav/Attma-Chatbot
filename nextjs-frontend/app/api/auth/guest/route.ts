import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // For now, redirect to login page
  return NextResponse.redirect(new URL('/login', request.url));
}
