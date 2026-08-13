import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('Unauthorized', 401)

    const notifications = await db.notification.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      // No limit, so they can see all notifications
    })

    return apiSuccess(notifications)
  } catch (error) {
    return apiError('Internal Server Error', 500)
  }
}
