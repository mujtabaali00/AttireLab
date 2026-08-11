import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { createProductSchema } from '@/lib/validations/product.schema'
import { serializeProduct } from '@/lib/product-serializer'
import { logger } from '@/lib/logger'
import { ZodError } from 'zod'

// GET /api/products — public, paginated
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const isAdmin = session?.user?.role === 'ADMIN'
    
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Number(searchParams.get('limit') || 20))
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || undefined
    const statusParam = searchParams.get('status') || undefined

    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(!isAdmin ? { status: 'ACTIVE' } : statusParam ? { status: statusParam } : {}),
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { images: true, category: true, specifications: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    const serialized = products.map(serializeProduct)

    return apiSuccess({ products: serialized, total, page, limit })
  } catch (error) {
    logger.error({ error }, 'Failed to fetch products')
    return apiError('Failed to fetch products', 500)
  }
}

// POST /api/products — ADMIN only
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const body = await req.json()
    const data = createProductSchema.parse(body)

    const product = await db.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        quantity: data.quantity,
        categoryId: data.categoryId,
        images: {
          create: data.imageUrls.map(url => ({ url })),
        },
        specifications: data.specifications && data.specifications.length > 0 ? {
          create: data.specifications.map(spec => ({
            color: spec.color || null,
            size: spec.size || null,
            quantity: spec.quantity,
            price: spec.price || null,
            imageUrl: spec.imageUrl || null
          }))
        } : undefined
      },
      include: { images: true, category: true, specifications: true },
    })

    logger.info({ productId: product.id, adminId: session.user.id }, 'Product created')

    return apiSuccess(serializeProduct(product), 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError('Validation failed', 400, error.flatten())
    }
    logger.error({ error }, 'Failed to create product')
    return apiError('Failed to create product', 500)
  }
}
