import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { ProductStatus } from '@prisma/client'
import { logger } from '@/lib/logger'

// POST /api/checkout
// Creates a Stripe Checkout Session from the user's current DB cart.
// Returns { url } — the hosted Stripe checkout page to redirect the user to.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { shippingAddress } = body as { shippingAddress: Record<string, string> }

    if (!shippingAddress?.address) {
      return NextResponse.json({ error: 'Shipping address is required' }, { status: 400 })
    }

    // Load cart with products
    const userCart = await db.cart.findFirst({
      where: { userId: dbUser.id },
      include: {
        items: {
          include: {
            product: { include: { specifications: true } }
          }
        }
      }
    })

    if (!userCart || userCart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty or expired' }, { status: 400 })
    }

    // Verify all cart products are still ACTIVE
    const inactiveItems = userCart.items.filter(i => i.product.status !== ProductStatus.ACTIVE)
    if (inactiveItems.length > 0) {
      return NextResponse.json({
        error: `Some items are no longer available: ${inactiveItems.map(i => i.product.name).join(', ')}`
      }, { status: 409 })
    }

    // Build Stripe line items
    const lineItems = userCart.items.map(item => {
      let unitPrice = Number(item.product.price)
      let variantLabel = item.product.name

      if (item.specificationId) {
        const spec = item.product.specifications.find(s => s.id === item.specificationId)
        if (spec) {
          if (spec.price) unitPrice = Number(spec.price)
          const parts = [spec.color, spec.size].filter(Boolean)
          if (parts.length > 0) variantLabel += ` (${parts.join(', ')})`
        }
      }

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: variantLabel,
          },
          // Stripe uses cents
          unit_amount: Math.round(unitPrice * 100),
        },
        quantity: item.quantity,
      }
    })

    // Store shipping address + cart snapshot in metadata so the webhook can create the order
    const metadataPayload = JSON.stringify({
      userId: dbUser.id,
      cartId: userCart.id,
      shippingAddress,
    })

    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      // Tax: 10% — add a flat tax rate in Stripe dashboard or use automatic_tax
      // For now we handle tax ourselves in order total
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart`,
      customer_email: dbUser.email,
      metadata: {
        payload: metadataPayload,
      },
      // Expire in 30 min matching cart expiry
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    return NextResponse.json({ url: stripeSession.url })
  } catch (error) {
    logger.error({ error }, 'Stripe checkout session creation failed')
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
