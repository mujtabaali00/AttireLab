import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { getCart, releaseExpiredCarts } from '@/lib/cart'
import { apiSuccess, apiError } from '@/lib/api-response'
import { APP_CONSTANTS } from '@/lib/constants'
import { logger } from '@/lib/logger'

type RouteCtx = { params: Promise<{ id: string }> }

// POST /api/orders/[id]/reorder
export async function POST(req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('User not found', 404)

    const { id } = await params

    // Fetch the order and verify ownership
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!order) return apiError('Order not found', 404)
    if (order.userId !== dbUser.id) return apiError('Forbidden', 403)

    await releaseExpiredCarts()
    const cart = await getCart()
    if (!cart) return apiError('Could not retrieve cart', 500)

    // Verify stock first
    for (const item of order.items) {
      const product = await db.product.findUnique({ where: { id: item.productId } })
      if (!product || product.status !== 'ACTIVE') {
        return apiError(`Product "${item.productName}" is no longer available.`, 400)
      }

      let maxStock = product.quantity
      if (item.specificationId) {
        const spec = await db.productSpecification.findUnique({ where: { id: item.specificationId } })
        if (!spec) return apiError(`Variant for "${item.productName}" is no longer available.`, 400)
        maxStock = spec.quantity
      }

      if (maxStock < item.quantity) {
        return apiError(`Insufficient stock to re-order "${item.productName}". Only ${maxStock} items left.`, 400)
      }
    }

    // Run transaction to deduct stock and populate the cart
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        // 1. Deduct stock
        if (item.specificationId) {
          await tx.productSpecification.update({
            where: { id: item.specificationId },
            data: { quantity: { decrement: item.quantity } }
          })
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } }
        })

        // 2. Add or update cart item
        const existingItem = cart.items.find(
          i => i.productId === item.productId && i.specificationId === item.specificationId
        )

        if (existingItem) {
          await tx.cartItem.update({
            where: { id: existingItem.id },
            data: { quantity: { increment: item.quantity } }
          })
        } else {
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: item.productId,
              specificationId: item.specificationId,
              quantity: item.quantity
            }
          })
        }
      }

      // 3. Update cart expiration
      await tx.cart.update({
        where: { id: cart.id },
        data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) }
      })
    })

    return apiSuccess({ success: true, message: 'All items added to cart successfully.' })
  } catch (error) {
    logger.error({ error }, 'REORDER_POST_ERROR')
    return apiError('Internal server error', 500)
  }
}
