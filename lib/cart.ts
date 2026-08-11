import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { APP_CONSTANTS } from './constants'
import { v4 as uuidv4 } from 'uuid'

// Clean up expired carts and restore stock globally
export async function releaseExpiredCarts() {
  const expiredCarts = await db.cart.findMany({
    where: { expiresAt: { lt: new Date() } },
    include: { items: true },
  })

  if (expiredCarts.length === 0) return

  // For each cart, restore stock and delete the cart (or just clear items)
  await db.$transaction(async (tx) => {
    for (const cart of expiredCarts) {
      for (const item of cart.items) {
        // Restore stock in product or spec
        if (item.color || item.size) {
          const spec = await tx.productSpecification.findFirst({
            where: {
              productId: item.productId,
              color: item.color || null,
              size: item.size || null,
            },
          })
          if (spec) {
            await tx.productSpecification.update({
              where: { id: spec.id },
              data: { quantity: { increment: item.quantity } },
            })
          }
        }
        // Always restore total product stock
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        })
      }
      // Delete the cart
      await tx.cart.delete({ where: { id: cart.id } })
    }
  })
}

// Get or create cart for current user/guest
export async function getCart() {
  const session = await auth()
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(APP_CONSTANTS.CART.GUEST_COOKIE_NAME)?.value

  let cart = null

  if (session?.user?.id) {
    cart = await db.cart.findFirst({
      where: { userId: session.user.id },
      include: { items: { include: { product: { include: { images: true } } } } },
    })
    
    // Merge guest cart if user just logged in
    if (!cart && sessionId) {
      cart = await db.cart.findUnique({
        where: { sessionId },
        include: { items: { include: { product: { include: { images: true } } } } },
      })
      if (cart) {
        await db.cart.update({
          where: { id: cart.id },
          data: { userId: session.user.id, sessionId: null },
        })
      }
    }
  } else {
    if (!sessionId) {
      sessionId = uuidv4()
      cookieStore.set(APP_CONSTANTS.CART.GUEST_COOKIE_NAME, sessionId, {
        maxAge: APP_CONSTANTS.CART.EXPIRATION_HOURS * 3600,
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
    }
    
    cart = await db.cart.findUnique({
      where: { sessionId },
      include: { items: { include: { product: { include: { images: true } } } } },
    })
  }

  // Create empty cart if none exists
  if (!cart) {
    cart = await db.cart.create({
      data: {
        userId: session?.user?.id || null,
        sessionId: !session?.user?.id ? sessionId : null,
        expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000),
      },
      include: { items: { include: { product: { include: { images: true } } } } },
    })
  }

  // If cart exists, extend expiration
  if (cart) {
    await db.cart.update({
      where: { id: cart.id },
      data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) },
    })
  }

  return cart
}
