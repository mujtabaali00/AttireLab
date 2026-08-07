import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { OrderStatus } from '@prisma/client'

// PATCH /api/orders/[id] — ADMIN only
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params
    const body = await req.json()
    const { status } = body as { status: OrderStatus }

    if (!status) {
      return apiError('Status is required', 400)
    }

    const order = await db.order.update({
      where: { id },
      data: { status },
    })

    return apiSuccess(order)
  } catch (error) {
    return apiError('Failed to update order status', 500)
  }
}
