import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { ProductStatus } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/products/[id]/status — ADMIN only: activate/deactivate (soft delete is INACTIVE)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { status } = body as { status?: string }

    if (status !== ProductStatus.ACTIVE && status !== ProductStatus.INACTIVE) {
      return apiError('Invalid status', 400)
    }

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return apiError('Product not found', 404)

    await db.product.update({ where: { id }, data: { status } })

    logger.info({ productId: id, adminId: session.user.id, status }, 'Product status changed')

    return apiSuccess({ status })
  } catch (error) {
    logger.error({ error }, 'Failed to update product status')
    return apiError('Failed to update product status', 500)
  }
}
