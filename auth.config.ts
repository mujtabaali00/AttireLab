import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET

if (!googleClientId || !googleClientSecret) {
  throw new Error('Missing Google OAuth env vars: set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET')
}

export const authConfig = {
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role || 'CUSTOMER'
        token.rememberMe = user.rememberMe ?? false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.role = (token.role as 'CUSTOMER' | 'ADMIN') || 'CUSTOMER'
      }
      // Auth.js always reports `session.expires` as now + the static
      // session.maxAge config, ignoring the JWT's real per-user `exp` set by
      // our custom jwt.encode — override it here so clients see the true expiry.
      if (typeof token.exp === 'number') {
        session.expires = new Date(token.exp * 1000).toISOString() as typeof session.expires
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    },
  },
} satisfies NextAuthConfig
