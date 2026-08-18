import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCart, releaseExpiredCarts } from '@/lib/cart'
import { apiSuccess, apiError } from '@/lib/api-response'
import { APP_CONSTANTS } from '@/lib/constants'

export async function GET() {
  try {
    await releaseExpiredCarts()
    const cart = await getCart()
    return apiSuccess(cart)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    await releaseExpiredCarts()

    const body = await req.json()
    const { productId, specificationId, quantity } = body as {
      productId?: string
      specificationId?: string | null
      quantity?: number
    }

    if (!productId || !quantity) {
      return apiError('Missing required fields', 400)
    }

    const cart = await getCart()
    if (!cart) return apiError('Could not get cart', 500)

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) return apiError('Product not found', 404)

    // Find the specification (variant) to check actual stock
    let maxStock = product.quantity
    if (specificationId) {
      const spec = await db.productSpecification.findUnique({ where: { id: specificationId } })
      if (!spec || spec.productId !== productId) return apiError('Variant not found', 404)
      maxStock = spec.quantity
    }

    if (maxStock < quantity) {
      return apiError(`Only ${maxStock} items left in stock`, 400)
    }

    // Wrap in transaction: update stock & add to cart
    await db.$transaction(async (tx) => {
      // Deduct stock
      if (specificationId) {
        await tx.productSpecification.update({
          where: { id: specificationId },
          data: { quantity: { decrement: quantity } }
        })
      }
      await tx.product.update({
        where: { id: productId },
        data: { quantity: { decrement: quantity } }
      })

      // Add or update cart item
      const existingItem = cart.items.find(i => i.productId === productId && i.specificationId === (specificationId || null))

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: { increment: quantity } }
        })
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            specificationId: specificationId || null,
            quantity
          }
        })
      }

      // Update cart expiration
      await tx.cart.update({
        where: { id: cart.id },
        data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) }
      })

      // Create ADDED_TO_CART notification for logged-in users
      if (cart.userId) {
        await tx.notification.create({
          data: {
            userId: cart.userId,
            message: `"${product.name}" has been added to your cart.`,
            type: 'ADDED_TO_CART'
          }
        })
      }
    })

    const updatedCart = await getCart()
    return apiSuccess(updatedCart)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const itemId = searchParams.get('itemId')
    const cart = await getCart()

    if (!cart) return apiError('Cart not found', 404)

    if (itemId) {
      const item = await db.cartItem.findUnique({ where: { id: itemId } })
      if (!item || item.cartId !== cart.id) return apiError('Item not found in your cart', 404)

      await db.$transaction(async (tx) => {
        // Restore stock
        if (item.specificationId) {
          await tx.productSpecification.update({
            where: { id: item.specificationId },
            data: { quantity: { increment: item.quantity } }
          })
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } }
        })

        // Remove item
        await tx.cartItem.delete({ where: { id: itemId } })
      })
    } else {
      // Clear entire cart
      await db.$transaction(async (tx) => {
        for (const item of cart.items) {
          if (item.specificationId) {
            await tx.productSpecification.update({
              where: { id: item.specificationId },
              data: { quantity: { increment: item.quantity } }
            })
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } }
          })
        }
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
      })
    }

    const updatedCart = await getCart()
    return apiSuccess(updatedCart)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId, quantity } = body
    if (!itemId || quantity === undefined || quantity < 1) return apiError('Invalid data', 400)

    const cart = await getCart()
    if (!cart) return apiError('Cart not found', 404)

    const item = await db.cartItem.findUnique({ where: { id: itemId } })
    if (!item || item.cartId !== cart.id) return apiError('Item not found', 404)

    const diff = quantity - item.quantity

    if (diff > 0) {
      // Need more stock
      let maxStock = 0
      if (item.specificationId) {
        const spec = await db.productSpecification.findUnique({ where: { id: item.specificationId } })
        if (spec) maxStock = spec.quantity
      } else {
        const prod = await db.product.findUnique({ where: { id: item.productId } })
        if (prod) maxStock = prod.quantity
      }

      if (maxStock < diff) return apiError(`Only ${maxStock} items left in stock`, 400)

      await db.$transaction(async (tx) => {
        if (item.specificationId) await tx.productSpecification.update({ where: { id: item.specificationId }, data: { quantity: { decrement: diff } } })
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { decrement: diff } } })
        await tx.cartItem.update({ where: { id: itemId }, data: { quantity } })
        await tx.cart.update({ where: { id: cart.id }, data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) } })
      })
    } else if (diff < 0) {
      // Returning stock
      const absDiff = Math.abs(diff)
      await db.$transaction(async (tx) => {
        if (item.specificationId) await tx.productSpecification.update({ where: { id: item.specificationId }, data: { quantity: { increment: absDiff } } })
        await tx.product.update({ where: { id: item.productId }, data: { quantity: { increment: absDiff } } })
        await tx.cartItem.update({ where: { id: itemId }, data: { quantity } })
        await tx.cart.update({ where: { id: cart.id }, data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) } })
      })
    }

    const updatedCart = await getCart()
    return apiSuccess(updatedCart)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unknown error', 500)
  }
}
