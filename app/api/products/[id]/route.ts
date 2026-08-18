import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { updateProductSchema } from '@/lib/validations/product.schema'
import { serializeProduct } from '@/lib/product-serializer'
import { logger } from '@/lib/logger'
import { ZodError } from 'zod'
import { Prisma, ProductStatus } from '@prisma/client'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] — public
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params

    const product = await db.product.findUnique({
      where: { id },
      include: { images: true, category: true, specifications: true },
    })

    if (!product) {
      return apiError('Product not found', 404)
    }

    if (product.status !== ProductStatus.ACTIVE) {
      return apiError('Product not found', 404)
    }

    return apiSuccess(serializeProduct(product))
  } catch (error) {
    logger.error({ error }, 'Failed to fetch product')
    return apiError('Failed to fetch product', 500)
  }
}

// PATCH /api/products/[id] — ADMIN only
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params
    const body = await req.json()
    const data = updateProductSchema.parse(body)

    const existing = await db.product.findUnique({
      where: { id },
      include: { images: true, specifications: true },
    })

    if (!existing) {
      return apiError('Product not found', 404)
    }

    const product = await db.$transaction(async tx => {
      // Update base product fields
      await tx.product.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.quantity !== undefined && { quantity: data.quantity }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        },
      })

      // Replace images if provided
      if (data.imageUrls) {
        await tx.productImage.deleteMany({ where: { productId: id } })
        if (data.imageUrls.length > 0) {
          await tx.productImage.createMany({
            data: data.imageUrls.map(url => ({ url, productId: id })),
          })
        }
      }

      // Replace specifications if provided (empty array removes all specs)
      if (data.specifications !== undefined) {
        await tx.productSpecification.deleteMany({ where: { productId: id } })
        if (data.specifications.length > 0) {
          await tx.productSpecification.createMany({
            data: data.specifications.map(spec => ({
              productId: id,
              color: spec.color || null,
              size: spec.size || null,
              quantity: spec.quantity,
              price: spec.price || null,
              imageUrl: spec.imageUrl || null,
            })),
          })
        }
      }

      return tx.product.findUnique({
        where: { id },
        include: { images: true, category: true, specifications: true },
      })
    })

    logger.info({ productId: id, adminId: session.user.id }, 'Product updated')

    return apiSuccess(serializeProduct(product!))
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError('Validation failed', 400, error.flatten())
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return apiError('Two variants have the same color and size — each combination must be unique', 400)
    }
    logger.error({ error }, 'Failed to update product')
    return apiError('Failed to update product', 500)
  }
}

// DELETE /api/products/[id] — ADMIN only
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const { id } = await params

    const existing = await db.product.findUnique({
      where: { id },
    })
    
    if (!existing) {
      return apiError('Product not found', 404)
    }

    // Soft delete: Set status to INACTIVE instead of deleting
    await db.product.update({
      where: { id },
      data: { status: 'INACTIVE' }
    })

    logger.info({ productId: id, adminId: session.user.id }, 'Product soft-deleted (INACTIVE)')

    return apiSuccess({ deleted: true })
  } catch (error) {
    logger.error({ error }, 'Failed to soft delete product')
    return apiError('Failed to delete product', 500)
  }
}
