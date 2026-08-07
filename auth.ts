import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/lib/validations/auth.schema'
import { authConfig } from './auth.config'
import { logger } from '@/lib/logger'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials)

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
            return user
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
