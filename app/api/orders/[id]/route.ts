import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { OrderStatus, NotificationType } from '@prisma/client'

type RouteCtx = { params: Promise<{ id: string }> }

// GET /api/orders/[id] — user (own) or admin
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const { id } = await params

    const order = await db.order.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        items: {
          include: { product: { include: { images: true } } }
        }
      }
    })

    if (!order) return apiError('Order not found', 404)

    // Check ownership: look up by email to avoid stale JWT id mismatches
    if (session.user.role !== 'ADMIN') {
      const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
      if (!dbUser || order.userId !== dbUser.id) return apiError('Forbidden', 403)
    }

    return apiSuccess(order)
  } catch {
    return apiError('Failed to fetch order', 500)
  }
}

// PATCH /api/orders/[id] — ADMIN only: change status
export async function PATCH(req: NextRequest, { params }: RouteCtx) {
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

    const existing = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { include: { specifications: true } }
          }
        }
      }
    })

    if (!existing) return apiError('Order not found', 404)

    // Restore stock if transitioning TO cancelled (and wasn't already cancelled)
    const wasAlreadyCancelled = existing.status === 'CANCELLED'
    const isNowCancelled = status === 'CANCELLED'
    const shouldRestoreStock = isNowCancelled && !wasAlreadyCancelled

    const order = await db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status },
      })

      if (shouldRestoreStock) {
        for (const item of existing.items) {
          // Find matching spec if color/size exist
          if (item.color || item.size) {
            const spec = item.product.specifications.find(
              s =>
                (s.color === item.color || (!s.color && !item.color)) &&
                (s.size === item.size || (!s.size && !item.size))
            )
            if (spec) {
              await tx.productSpecification.update({
                where: { id: spec.id },
                data: { quantity: { increment: item.quantity } }
              })
              await tx.product.update({
                where: { id: item.productId },
                data: { quantity: { increment: item.quantity } }
              })
              continue
            }
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } }
          })
        }
      }

      // Notify user about status change
      const statusMessages: Partial<Record<OrderStatus, { message: string; type: NotificationType }>> = {
        CANCELLED: {
          message: `Your order #${id.slice(-8).toUpperCase()} has been cancelled.`,
          type: 'ORDER_CANCELLED'
        },
        SHIPPED: {
          message: `Your order #${id.slice(-8).toUpperCase()} has been shipped!`,
          type: 'SYSTEM'
        },
        DELIVERED: {
          message: `Your order #${id.slice(-8).toUpperCase()} has been delivered.`,
          type: 'SYSTEM'
        },
        PROCESSING: {
          message: `Your order #${id.slice(-8).toUpperCase()} is now being processed.`,
          type: 'SYSTEM'
        },
      }

      const notifData = statusMessages[status]
      if (notifData) {
        await tx.notification.create({
          data: {
            userId: existing.userId,
            message: notifData.message,
            type: notifData.type,
          }
        })
      }

      return updated
    })

    return apiSuccess(order)
  } catch (error) {
    return apiError('Failed to update order status', 500)
  }
}
