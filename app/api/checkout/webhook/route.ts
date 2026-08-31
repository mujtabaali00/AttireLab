import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ProductStatus } from '@prisma/client'

// POST /api/checkout/webhook
// Stripe calls this endpoint after a successful payment.
// We verify the webhook signature, then create the DB order.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    logger.error({ err }, 'Webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge other events we don't handle
    return NextResponse.json({ received: true })
  }

  const stripeSession = event.data.object

  // Idempotency: skip if we already processed this Stripe session
  const existing = await db.order.findFirst({
    where: { stripeSessionId: stripeSession.id }
  })
  if (existing) {
    return NextResponse.json({ received: true })
  }

  let payload: {
    userId: string
    cartId: string
    shippingAddress: Record<string, string>
  }

  try {
    payload = JSON.parse(stripeSession.metadata?.payload || '{}')
  } catch {
    logger.error('Failed to parse Stripe session metadata payload')
    return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
  }

  const { userId, cartId, shippingAddress } = payload

  if (!userId || !cartId) {
    return NextResponse.json({ error: 'Missing userId or cartId in metadata' }, { status: 400 })
  }

  // Load the cart that was reserved at checkout time
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: { include: { specifications: true, images: true } }
        }
      }
    }
  })

  if (!cart) {
    // Cart already cleaned up — this is fine if webhook fired twice; just ack
    logger.warn({ cartId }, 'Cart not found in webhook — may have already been processed')
    return NextResponse.json({ received: true })
  }

  const inactiveItems = cart.items.filter(i => i.product.status !== ProductStatus.ACTIVE)
  if (inactiveItems.length > 0) {
    // Edge case: product deactivated between checkout and payment
    logger.error({ cartId, inactiveItems }, 'Payment received but some products are now inactive')
    // TODO: issue a Stripe refund here in production
    return NextResponse.json({ received: true })
  }

  // Build order items + compute totals
  let subtotal = 0
  const orderItemsData = cart.items.map(item => {
    let unitPrice = Number(item.product.price)
    let color: string | null = null
    let size: string | null = null

    if (item.specificationId) {
      const spec = item.product.specifications.find(s => s.id === item.specificationId)
      if (spec) {
        if (spec.price) unitPrice = Number(spec.price)
        color = spec.color
        size = spec.size
      }
    }

    subtotal += unitPrice * item.quantity
    return {
      productId: item.productId,
      specificationId: item.specificationId || null,
      productName: item.product.name,
      unitPrice,
      quantity: item.quantity,
      color,
      size,
    }
  })

  const tax = subtotal * 0.10
  const total = subtotal + tax

  await db.$transaction(async (tx) => {
    // Create the order
    const order = await tx.order.create({
      data: {
        userId,
        subtotal,
        tax,
        total,
        shippingAddress: shippingAddress ?? {},
        stripeSessionId: stripeSession.id,
        items: { create: orderItemsData }
      }
    })

    // Delete ordered cart items (stock already deducted at add-to-cart)
    await tx.cartItem.deleteMany({ where: { cartId } })

    // User notification
    await tx.notification.create({
      data: {
        userId,
        message: `Your order #${order.id.slice(-8).toUpperCase()} has been placed successfully.`,
        type: 'ORDER_CONFIRMED'
      }
    })

    // Admin notifications
    const admins = await tx.user.findMany({ where: { role: 'ADMIN' } })
    if (admins.length > 0) {
      const dbUser = await tx.user.findUnique({ where: { id: userId } })
      await tx.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          message: `New order #${order.id.slice(-8).toUpperCase()} placed by ${dbUser?.name || 'a customer'}.`,
          type: 'ORDER_CONFIRMED' as const
        }))
      })
    }
  })

  return NextResponse.json({ received: true })
}
