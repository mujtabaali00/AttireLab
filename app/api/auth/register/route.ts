
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { registerSchema } from '@/lib/validations/auth.schema'
import { apiSuccess, apiError } from '@/lib/api-response'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    const validatedData = registerSchema.safeParse(body)
    if (!validatedData.success) {
      return apiError('Validation failed', 400, validatedData.error.flatten().fieldErrors)
    }

    const { name, email, password } = validatedData.data

    const existingUser = await db.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return apiError('Email already in use', 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'CUSTOMER'
      }
    })

    logger.info({ email }, 'New user registered successfully')
    return apiSuccess({ message: 'Account created successfully' }, 201)
  } catch (error) {
    logger.error({ error }, 'REGISTER_ERROR')
    return apiError('Internal server error', 500)
  }
}
