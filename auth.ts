import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { encode } from 'next-auth/jwt'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/lib/validations/auth.schema'
import { authConfig } from './auth.config'
import { logger } from '@/lib/logger'

const REMEMBER_ME_MAX_AGE = 24 * 60 * 60 // 24 hours
const DEFAULT_MAX_AGE = 12 * 60 * 60 // 12 hours

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  // Cap the cookie itself at the longer of the two durations; the JWT's own
  // exp (set below) is what actually enforces the 12h/24h rememberMe split.
  session: { strategy: 'jwt', maxAge: REMEMBER_ME_MAX_AGE },
  jwt: {
    // Auth.js's default encode() always sets exp = now + session.maxAge,
    // ignoring any `exp` a jwt() callback sets on the token — so rememberMe
    // has to be enforced here, by controlling the maxAge passed to encode().
    encode: async ({ token, secret, salt }) => {
      const maxAge = token?.rememberMe ? REMEMBER_ME_MAX_AGE : DEFAULT_MAX_AGE
      return encode({ token, secret, salt, maxAge })
    },
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: {},
        password: {},
        rememberMe: {},
      },
      async authorize(credentials) {
        try {
          // NextAuth always sends `credentials` as a URL-encoded form POST, so
          // rememberMe arrives as the string "true"/"false", not a real boolean.
          const { email, password, rememberMe } = await loginSchema.parseAsync({
            ...credentials,
            rememberMe: credentials?.rememberMe === true || credentials?.rememberMe === 'true',
          })

          const user = await db.user.findUnique({
            where: { email }
          })

          if (!user || !user.passwordHash) {
            logger.warn({ email }, 'Failed login attempt: User not found or no password hash')
            return null
          }

          const passwordsMatch = await bcrypt.compare(password, user.passwordHash)

          if (passwordsMatch) {
            logger.info({ userId: user.id, email: user.email, role: user.role }, 'User authenticated via credentials')
            return { ...user, rememberMe }
          } else {
            logger.warn({ email }, 'Failed login attempt: Password mismatch')
          }
        } catch (error) {
          logger.error({ error }, 'Error in authorize function')
          return null
        }

        return null
      },
    }),
  ],
})
