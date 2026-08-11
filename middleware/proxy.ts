import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const role = req.auth?.user?.role

  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth')
  const isAuthRoute = nextUrl.pathname.startsWith('/auth')
  const isAdminLoginRoute = nextUrl.pathname === '/admin/login'
  const isAdminRoute = nextUrl.pathname.startsWith('/admin')
  const isCustomerProtectedRoute = nextUrl.pathname.startsWith('/orders') || nextUrl.pathname.startsWith('/checkout')

  if (isApiAuthRoute) {
    return
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', nextUrl))
    }
    return
  }

  if (isAdminLoginRoute) {
    if (isLoggedIn && role === 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/products', nextUrl))
    }
    return
  }

  if (isAdminRoute && !isAdminLoginRoute) {
    if (!isLoggedIn || role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/login', nextUrl))
    }
    return
  }

  if (isCustomerProtectedRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/auth/login', nextUrl))
    }
    return
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
