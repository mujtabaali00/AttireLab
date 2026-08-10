import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return apiError('Unauthorized', 401)

    const { id } = await req.json().catch(() => ({}))

    if (id) {
      await db.notification.update({
        where: { id, userId: session.user.id },
        data: { read: true }
      })
    } else {
      await db.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true }
      })
    }

    return apiSuccess({ success: true })
  } catch (error) {
    return apiError('Failed to mark notification as read', 500)
  }
}
