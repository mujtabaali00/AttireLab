import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { resetPasswordSchema } from '@/lib/validations/auth.schema'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedData = resetPasswordSchema.safeParse(body)
    
    if (!validatedData.success) {
      return apiError('Validation failed', 400, validatedData.error.flatten().fieldErrors)
    }

    const { token, password } = validatedData.data

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token }
    })

    if (!resetToken || resetToken.used) {
      return apiError('Invalid or used token', 400)
    }

    if (resetToken.expiresAt < new Date()) {
      return apiError('Token has expired', 410)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })
    ])

    return apiSuccess({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('[RESET_PASSWORD_ERROR]', error)
    return apiError('Internal server error', 500)
  }
}
