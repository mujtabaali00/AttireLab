import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

// PATCH /api/notifications/mark-read — mark one or all as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('Unauthorized', 401)

    const body = await req.json().catch(() => ({}))
    const { id } = body as { id?: string }

    if (id) {
      // Mark a single notification as read (only if it belongs to the user)
      await db.notification.updateMany({
        where: { id, userId: dbUser.id },
        data: { read: true },
      })
    } else {
      // Mark all of the user's notifications as read
      await db.notification.updateMany({
        where: { userId: dbUser.id, read: false },
        data: { read: true },
      })
    }

    return apiSuccess({ ok: true })
  } catch {
    return apiError('Internal Server Error', 500)
  }
}
