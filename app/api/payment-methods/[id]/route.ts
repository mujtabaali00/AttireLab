import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'

type RouteCtx = { params: Promise<{ id: string }> }

// DELETE /api/payment-methods/[id] — detaches (deletes) a payment method
export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await auth()
    if (!session?.user?.email) return apiError('Unauthorized', 401)

    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) return apiError('User not found', 404)

    if (!stripe) {
      return apiError('Stripe not configured', 500)
    }

    const { id } = await params

    // Verify payment method belongs to the user by checking its customer property
    try {
      const pm = await stripe.paymentMethods.retrieve(id)
      if (pm.customer !== dbUser.stripeCustomerId) {
        return apiError('Unauthorized', 403)
      }

      // Detach payment method
      await stripe.paymentMethods.detach(id)
      return apiSuccess({ message: 'Payment method removed' })
    } catch (stripeErr: any) {
      logger.error({ stripeErr }, 'Stripe detach error')
      return apiError(stripeErr.message || 'Failed to remove payment method', 400)
    }
  } catch (error) {
    logger.error({ error }, 'DELETE_PAYMENT_METHOD_ERROR')
    return apiError('Internal server error', 500)
  }
}
