import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api-response'
import { createCategorySchema } from '@/lib/validations/category.schema'
import { ZodError } from 'zod'

// GET /api/categories — public
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { name: 'asc' },
    })
    return apiSuccess(categories)
  } catch {
    return apiError('Failed to fetch categories', 500)
  }
}

// POST /api/categories — ADMIN only
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const body = await req.json()
    const data = createCategorySchema.parse(body)

    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const category = await db.category.create({
      data: { name: data.name, slug },
    })

    return apiSuccess(category, 201)
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError('Validation failed', 400, error.flatten())
    }
    return apiError('Failed to create category', 500)
  }
}
