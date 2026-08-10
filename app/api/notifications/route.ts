import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return apiError('Unauthorized', 401)

    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return apiSuccess(notifications)
  } catch (error) {
    return apiError('Failed to fetch notifications', 500)
  }
}
