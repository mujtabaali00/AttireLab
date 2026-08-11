import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

export const authConfig = {
  pages: {
    signIn: '/auth/login',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role || 'CUSTOMER'
        
        // Custom expiration logic based on rememberMe
        const rememberMe = (user as any).rememberMe
        const hours = rememberMe ? 24 : 12
        token.exp = Math.floor(Date.now() / 1000) + (hours * 60 * 60)
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.role = (token.role as 'CUSTOMER' | 'ADMIN') || 'CUSTOMER'
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
