import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { APP_CONSTANTS } from './constants'
import { v4 as uuidv4 } from 'uuid'
import type { Prisma } from '@prisma/client'

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

type CartWithItems = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>

// Combine a guest cart into a user's existing cart: items for the same
// product+variant have their quantities summed, everything else is moved
// over as-is. Stock was already decremented when each item was originally
// added (in both carts independently), so this is pure bookkeeping — no
// stock re-validation needed.
async function mergeGuestCartIntoUserCart(userCart: CartWithItems, guestCart: CartWithItems): Promise<CartWithItems> {
  await db.$transaction(async (tx) => {
    for (const guestItem of guestCart.items) {
      const existing = userCart.items.find(
        i => i.productId === guestItem.productId && i.specificationId === guestItem.specificationId
      )
      if (existing) {
        await tx.cartItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: guestItem.quantity } },
        })
        await tx.cartItem.delete({ where: { id: guestItem.id } })
      } else {
        await tx.cartItem.update({
          where: { id: guestItem.id },
          data: { cartId: userCart.id },
        })
      }
    }
    await tx.cart.delete({ where: { id: guestCart.id } })
    await tx.cart.update({
      where: { id: userCart.id },
      data: { expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000) },
    })
  })

  return db.cart.findUniqueOrThrow({ where: { id: userCart.id }, include: CART_INCLUDE })
}

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

      // Merge in the guest cart (if any) left over from browsing before login.
      // This must run whether or not the user already has their own cart —
      // dropping it when a user cart already exists would silently discard
      // whatever the guest had just added.
      if (sessionId) {
        const guestCart = await db.cart.findUnique({
          where: { sessionId },
          include: CART_INCLUDE,
        })

        if (guestCart && guestCart.userId !== userId) {
          cart = cart
            ? await mergeGuestCartIntoUserCart(cart, guestCart)
            : await db.cart.update({
                where: { id: guestCart.id },
                data: {
                  userId,
                  sessionId: null,
                  expiresAt: new Date(Date.now() + APP_CONSTANTS.CART.EXPIRATION_HOURS * 60 * 60 * 1000),
                },
                include: CART_INCLUDE,
              })
        }

        try { cookieStore.delete(APP_CONSTANTS.CART.GUEST_COOKIE_NAME) } catch {
          // cookies().delete() can fail in some contexts, ignore
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
