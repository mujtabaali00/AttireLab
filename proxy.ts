import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from './auth.config'

// Deliberately built on auth.config.ts (Google provider + callbacks only) rather
// than the full auth.ts — this only needs to verify/read the JWT cookie, not
// issue it, so it doesn't need the Node-only pieces (Prisma adapter, bcryptjs).
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
  if (!isAdminRoute) return NextResponse.next()

  if (!req.auth || req.auth.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/auth/login', req.nextUrl.origin))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/admin/:path*'],
}
