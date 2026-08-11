import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'

type RouteCtx = { params: Promise<{ id: string }> }

// DELETE /api/categories/[id] — ADMIN only
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params

    const category = await db.category.findUnique({ where: { id } })
    if (!category) return apiError('Category not found', 404)

    // Check if any products are in this category
    const productCount = await db.product.count({ where: { categoryId: id } })
    if (productCount > 0) {
      return apiError(
        `Cannot delete: ${productCount} product(s) belong to this category. Reassign or delete them first.`,
        409
      )
    }

    await db.category.delete({ where: { id } })
    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete category', 500)
  }
}
