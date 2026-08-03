// SPDX-License-Identifier: MIT

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { UserRole } from './types/enums';

// We import authConfig but don't use Prisma in middleware as it runs on Edge.
// We configure a simple NextAuth instance just for session validation.
export const { auth } = NextAuth({
  providers: [],
  session: { strategy: 'jwt' },
});

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth');
  const isAuthRoute = nextUrl.pathname.startsWith('/login');

  if (isApiAuthRoute) return NextResponse.next();

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) {
      callbackUrl += nextUrl.search;
    }
    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl));
  }

  // --- Role-Based Access Control (RBAC) ---
  const role = req.auth?.user?.role as UserRole;

  // Settings page is now accessible to all logged-in users.
  // Role-based visibility is handled within the page component.

  // Users page is now accessible to all logged-in users.
  // Role-based visibility is handled within the page component.

  return NextResponse.next();
});

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images|clips).*)'],
};
