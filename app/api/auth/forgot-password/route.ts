import crypto from 'crypto'
import { db } from '@/lib/db'
import { forgotPasswordSchema } from '@/lib/validations/auth.schema'
import { apiSuccess, apiError } from '@/lib/api-response'
import { sendPasswordResetEmail } from '@/services/email/email.service'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedData = forgotPasswordSchema.safeParse(body)
    
    if (!validatedData.success) {
      return apiError('Validation failed', 400, validatedData.error.flatten().fieldErrors)
    }

    const { email } = validatedData.data

    const user = await db.user.findUnique({
      where: { email }
    })

    if (!user) {
      return apiError('No account found with that email', 404)
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await db.passwordResetToken.deleteMany({
      where: { userId: user.id, used: false }
    })

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        used: false
      }
    })

    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`
    
    await sendPasswordResetEmail(user.email, resetUrl)

    return apiSuccess({
      message: 'A reset link has been sent to your email'
    })
  } catch (error) {
    logger.error({ error }, 'FORGOT_PASSWORD_ERROR')
    return apiError('Internal server error', 500)
  }
}
