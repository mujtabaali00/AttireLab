import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { OrderStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    logger.error({ err }, 'Webhook signature verification failed')
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const paymentIntent = event.data.object as any
  const orderId = paymentIntent.metadata?.orderId

  if (!orderId) {
    // If it's not our order checkout flow payment, just acknowledge
    return NextResponse.json({ received: true })
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true }
  })

  if (!order) {
    logger.error({ orderId }, 'Order not found in DB for webhook event')
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Handle successful payments
  if (event.type === 'payment_intent.succeeded') {
    // Prevent double processing
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({ received: true })
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'PROCESSING',
          stripePaymentIntentId: paymentIntent.id
        }
      })

      // Notify user
      await tx.notification.create({
        data: {
          userId: order.userId,
          message: `Your payment for order #${order.id.slice(-8).toUpperCase()} was successful!`,
          type: 'ORDER_CONFIRMED'
        }
      })

      // Notify admins
      const admins = await tx.user.findMany({ where: { role: 'ADMIN' } })
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            message: `Order #${order.id.slice(-8).toUpperCase()} has been paid successfully.`,
            type: 'ORDER_CONFIRMED'
          }))
        })
      }
    })

    return NextResponse.json({ received: true })
  }

  // Handle failed payments
  if (event.type === 'payment_intent.payment_failed') {
    // Prevent double processing
    if (order.paymentStatus === 'FAILED' || order.status === 'PAYMENT_FAILED') {
      return NextResponse.json({ received: true })
    }

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
          status: 'PAYMENT_FAILED',
          stripePaymentIntentId: paymentIntent.id
        }
      })

      // Reverse stock
      for (const item of order.items) {
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

      // Notify user of failed payment
      await tx.notification.create({
        data: {
          userId: order.userId,
          message: `Payment for order #${order.id.slice(-8).toUpperCase()} failed. You can re-order from the order details page.`,
          type: 'ORDER_CANCELLED'
        }
      })
    })

    return NextResponse.json({ received: true })
  }

  return NextResponse.json({ received: true })
}
