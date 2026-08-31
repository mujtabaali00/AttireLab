import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'

// GET /api/payment-methods — lists all saved cards for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('User not found', 404)

    if (!stripe) {
      return apiSuccess([]) // Stripe not configured yet
    }

    let customerId = dbUser.stripeCustomerId
    if (!customerId) {
      // Lazily create Stripe customer if missing
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
        logger.error({ err }, 'Failed to lazily create Stripe customer')
        return apiError('Failed to initialize billing profile', 500)
      }
    }

    // List all card payment methods attached to the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    const formatted = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    }))

    return apiSuccess(formatted)
  } catch (error) {
    logger.error({ error }, 'GET_PAYMENT_METHODS_ERROR')
    return apiError('Internal server error', 500)
  }
}
