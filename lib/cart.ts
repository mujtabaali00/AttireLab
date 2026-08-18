import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { APP_CONSTANTS } from './constants'
import { v4 as uuidv4 } from 'uuid'

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: { images: true }
      },
      specification: true
    }
  }
} as const

// Clean up expired carts and restore stock globally
export async function releaseExpiredCarts() {
  try {
    const expiredCarts = await db.cart.findMany({
      where: { expiresAt: { lt: new Date() } },
      include: { items: true },
    })

    if (expiredCarts.length === 0) return

    await db.$transaction(async (tx) => {
      for (const cart of expiredCarts) {
        for (const item of cart.items) {
          if (item.specificationId) {
            await tx.productSpecification.update({
              where: { id: item.specificationId },
              data: { quantity: { increment: item.quantity } },
            })
          }
          // Always restore total product stock
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          })
        }
        await tx.cart.delete({ where: { id: cart.id } })
      }
    }, { timeout: 15000, maxWait: 10000 })
  } catch (err) {
    // Non-fatal: log and continue
    console.error('[releaseExpiredCarts] error:', err)
  }
}

// Get or create cart for current user/guest
export async function getCart() {
  const session = await auth()
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(APP_CONSTANTS.CART.GUEST_COOKIE_NAME)?.value

  let cart = null

  if (session?.user?.email) {
    // Look up user by email to get real DB id
    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    const userId = dbUser?.id

    if (userId) {
      cart = await db.cart.findFirst({
        where: { userId },
        include: CART_INCLUDE,
      })

      // Merge guest cart if user just logged in
      if (!cart && sessionId) {
        cart = await db.cart.findUnique({
          where: { sessionId },
          include: CART_INCLUDE,
        })
        if (cart) {
          await db.cart.update({
            where: { id: cart.id },
            data: { userId, sessionId: null },
          })
        }
      }

      // Create empty cart if none exists
      if (!cart) {
        cart = await db.cart.create({
          data: {
            userId,
            sessionId: null,
            expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000),
          },
          include: CART_INCLUDE,
        })
      }
    }
  } else {
    // Guest flow
    if (!sessionId) {
      sessionId = uuidv4()
      try {
        cookieStore.set(APP_CONSTANTS.CART.GUEST_COOKIE_NAME, sessionId, {
          maxAge: APP_CONSTANTS.CART.EXPIRATION_HOURS * 3600,
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        })
      } catch {
        // cookies().set() can fail in some contexts, ignore
      }
    }

    cart = await db.cart.findUnique({
      where: { sessionId },
      include: CART_INCLUDE,
    })

    if (!cart) {
      cart = await db.cart.create({
        data: {
          userId: null,
          sessionId,
          expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000),
        },
        include: CART_INCLUDE,
      })
    }
  }

  return cart
}
