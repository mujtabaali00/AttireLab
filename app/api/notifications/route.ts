import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { APP_CONSTANTS } from '@/lib/constants'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor') || undefined
    const limit = APP_CONSTANTS.NOTIFICATIONS.PAGE_SIZE

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: dbUser.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      }),
      db.notification.count({ where: { userId: dbUser.id, read: false } }),
    ])

    const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null

    return apiSuccess({ notifications, nextCursor, unreadCount })
  } catch (error) {
    logger.error({ error }, 'NOTIFICATIONS_FETCH_ERROR')
    return apiError('Internal Server Error', 500)
  }
}
