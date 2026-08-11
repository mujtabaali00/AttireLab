import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    // Look up by email to get real DB id
    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('User not found', 404)

    const notifications = await db.notification.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return apiSuccess(notifications)
  } catch (error) {
    return apiError('Failed to fetch notifications', 500)
  }
}
