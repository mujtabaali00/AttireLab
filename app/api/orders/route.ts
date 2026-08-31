import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { ProductStatus, OrderStatus } from '@prisma/client'
import { stripe } from '@/lib/stripe'

interface CartItemInput {
  productId: string
  quantity: number
  specificationId?: string | null
}

interface OrderItemPayload {
  productId: string
  specificationId: string | null
  productName: string
  unitPrice: number
  quantity: number
  color: string | null
  size: string | null
}

function getFriendlyDeclineMessage(err: any): string {
  if (err.type === 'StripeCardError') {
    switch (err.decline_code) {
      case 'insufficient_funds':
        return 'Your card has insufficient funds. Please check your balance and try again.'
      case 'lost_card':
      case 'stolen_card':
        return 'This card is reported lost or stolen. Please use a different card.'
      case 'expired_card':
        return 'Your card has expired. Please check the expiration date.'
      case 'incorrect_cvc':
        return 'The card CVC code is incorrect.'
      case 'incorrect_number':
        return 'The card number is incorrect.'
      default:
        return err.message || 'The payment was declined. Please try a different card.'
    }
  }
  return err.message || 'An unexpected error occurred during payment processing.'
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { items, shippingAddress, paymentMethodType, paymentMethodId, saveCard } = body as {
      items: CartItemInput[]
      shippingAddress: Record<string, string>
      paymentMethodType: 'CARD' | 'COD'
      paymentMethodId?: string
      saveCard?: boolean
    }

    if (!items || !items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    if (!paymentMethodType || !['CARD', 'COD'].includes(paymentMethodType)) {
      return NextResponse.json({ error: 'Valid payment method type is required' }, { status: 400 })
    }

    if (paymentMethodType === 'CARD' && !paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required for card payments' }, { status: 400 })
    }

    // Ensure all items are actually in the user's DB cart (where stock is reserved)
    const userCart = await db.cart.findFirst({ 
      where: { userId: dbUser.id },
      include: { items: true }
    })
    
    if (!userCart) {
      return NextResponse.json({ error: 'Cart session not found or expired. Please re-add items.' }, { status: 400 })
    }

    for (const item of items) {
      const cartItem = userCart.items.find(i =>
        i.productId === item.productId &&
        i.specificationId === (item.specificationId || null)
      )
      if (!cartItem || cartItem.quantity < item.quantity) {
        return NextResponse.json({ error: `Please refresh your cart. Some items were not properly reserved.` }, { status: 400 })
      }
    }

    // Fetch products to verify stock and price
    const productIds = items.map(i => i.productId)
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
      },
      include: { specifications: true }
    })

    let subtotal = 0
    const orderItemsData: OrderItemPayload[] = []

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return NextResponse.json({ error: `Product not found or unavailable: ${item.productId}` }, { status: 404 })
      }

      // Determine price/variant based on specificationId — stock already reserved in cart
      let itemPrice = Number(product.price)
      let color: string | null = null
      let size: string | null = null

      if (item.specificationId) {
        const spec = product.specifications.find(s => s.id === item.specificationId)
        if (!spec) {
          return NextResponse.json({ error: `Product variant is no longer available` }, { status: 404 })
        }
        itemPrice = spec.price ? Number(spec.price) : itemPrice
        color = spec.color
        size = spec.size
      }

      subtotal += itemPrice * item.quantity
      orderItemsData.push({
        productId: product.id,
        specificationId: item.specificationId || null,
        productName: product.name,
        unitPrice: itemPrice,
        quantity: item.quantity,
        color,
        size,
      })
    }

    const tax = subtotal * 0.10 // 10% tax
    const total = subtotal + tax

    // 1. Create the Order in DB
    const order = await db.order.create({
      data: {
        userId: dbUser.id,
        subtotal,
        tax,
        total,
        shippingAddress: shippingAddress ?? {},
        paymentMethod: paymentMethodType,
        paymentStatus: 'PENDING',
        status: 'PENDING',
        items: {
          create: orderItemsData
        }
      }
    })

    // 2. Handle Payment Processing
    if (paymentMethodType === 'COD') {
      // Clear ordered items from the cart so they don't expire later
      for (const item of items) {
        await db.cartItem.deleteMany({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            specificationId: item.specificationId || null
          }
        })
      }

      // Cash on Delivery succeeds immediately
      await db.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PENDING', status: 'PENDING' }
      })

      // Create notification for the user
      await db.notification.create({
        data: {
          userId: dbUser.id,
          message: `Your order #${order.id.slice(-8).toUpperCase()} has been placed successfully.`,
          type: 'ORDER_CONFIRMED'
        }
      })

      // Notify all admins
      const admins = await db.user.findMany({ where: { role: 'ADMIN' } })
      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            message: `New order #${order.id.slice(-8).toUpperCase()} placed by ${dbUser.name || 'a customer'}.`,
            type: 'ORDER_CONFIRMED'
          }))
        })
      }

      return NextResponse.json({ data: { success: true, orderId: order.id } }, { status: 201 })
    }

    // CARD Payment Processing
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    let customerId = dbUser.stripeCustomerId
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: dbUser.email,
          name: dbUser.name,
        })
        customerId = customer.id
        await db.user.update({
          where: { id: dbUser.id },
          data: { stripeCustomerId: customerId }
        })
      } catch (err) {
        logger.error({ err }, 'Failed to lazily create Stripe customer during checkout')
        return NextResponse.json({ error: 'Billing profile initialization failed' }, { status: 500 })
      }
    }

    try {
      if (paymentMethodId && customerId) {
        try {
          await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
        } catch (attachErr) {
          // Harmless if already attached
        }
      }

      // Create and confirm PaymentIntent on Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // cents
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        setup_future_usage: saveCard ? 'on_session' : undefined,
        metadata: { orderId: order.id },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never', // We handle redirects/3DS manually on the client
        },
      })

      if (paymentIntent.status === 'succeeded') {
        // Payment successful — now clear items from user's cart
        for (const item of items) {
          await db.cartItem.deleteMany({
            where: {
              cartId: userCart.id,
              productId: item.productId,
              specificationId: item.specificationId || null
            }
          })
        }

        await db.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'PROCESSING',
            stripePaymentIntentId: paymentIntent.id
          }
        })

        // Notify user & admin
        await db.notification.create({
          data: {
            userId: dbUser.id,
            message: `Your order #${order.id.slice(-8).toUpperCase()} has been placed and paid successfully.`,
            type: 'ORDER_CONFIRMED'
          }
        })

        const admins = await db.user.findMany({ where: { role: 'ADMIN' } })
        if (admins.length > 0) {
          await db.notification.createMany({
            data: admins.map(admin => ({
              userId: admin.id,
              message: `New paid order #${order.id.slice(-8).toUpperCase()} placed by ${dbUser.name || 'a customer'}.`,
              type: 'ORDER_CONFIRMED'
            }))
          })
        }

        return NextResponse.json({ data: { success: true, orderId: order.id } }, { status: 201 })
      }

      if (paymentIntent.status === 'requires_action') {
        // Payment requires 3D Secure / SCA
        await db.order.update({
          where: { id: order.id },
          data: { stripePaymentIntentId: paymentIntent.id }
        })

        return NextResponse.json({
          data: {
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
            orderId: order.id
          }
        }, { status: 200 })
      }

      // Handle other unusual statuses
      throw new Error(`Unexpected PaymentIntent status: ${paymentIntent.status}`)
    } catch (paymentError: any) {
      logger.error({ paymentError }, 'Stripe PaymentIntent failure')

      // Mark order as failed (Cart items remain intact in DB cart so user can retry)
      await db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          status: 'PAYMENT_FAILED'
        }
      })

      const friendlyMessage = getFriendlyDeclineMessage(paymentError)
      return NextResponse.json({ error: friendlyMessage, orderId: order.id }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Insufficient stock')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    logger.error({ error }, 'Order creation error')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up user by email to get real DB id
    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const orders = await db.order.findMany({
      where: dbUser.role === 'ADMIN' ? {} : { userId: dbUser.id },
      include: {
        _count: { select: { items: true } },
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ data: orders })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
