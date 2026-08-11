import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    // Look up by email to get real DB id
    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('User not found', 404)

    const body = await req.json().catch(() => ({}))
    const { id } = body

    if (id) {
      await db.notification.update({
        where: { id, userId: dbUser.id },
        data: { read: true }
      })
    } else {
      await db.notification.updateMany({
        where: { userId: dbUser.id, read: false },
        data: { read: true }
      })
    }

    return apiSuccess({ success: true })
  } catch (error) {
    return apiError('Failed to mark notification as read', 500)
  }
}
