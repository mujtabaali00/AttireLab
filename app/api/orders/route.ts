import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'

interface CartItemInput {
  productId: string
  quantity: number
  color?: string
  size?: string
}

interface OrderItemPayload {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  color: string | null
  size: string | null
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Always look up user by email to get the real DB id (avoids stale JWT id mismatches)
    const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { items, shippingAddress } = body as {
      items: CartItemInput[]
      shippingAddress: Record<string, string>
    }

    if (!items || !items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    // Fetch products to verify stock and price
    const productIds = items.map(i => i.productId)
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: { specifications: true }
    })

    let subtotal = 0
    const orderItemsData: OrderItemPayload[] = []
    const stockUpdates: { id: string, type: 'product' | 'spec', specId?: string, quantity: number }[] = []

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 404 })
      }

      // Determine stock and price based on specifications if any match
      let availableStock = product.quantity
      let itemPrice = Number(product.price)
      let specId: string | undefined = undefined

      if (item.color || item.size) {
        const spec = product.specifications.find(
          s => (s.color === item.color || (!s.color && !item.color)) &&
               (s.size === item.size || (!s.size && !item.size))
        )
        if (spec) {
          availableStock = spec.quantity
          itemPrice = spec.price ? Number(spec.price) : itemPrice
          specId = spec.id
        }
      }

      if (availableStock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name} ${item.color || ''} ${item.size || ''}` }, { status: 409 })
      }

      subtotal += itemPrice * item.quantity
      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        unitPrice: itemPrice,
        quantity: item.quantity,
        color: item.color || null,
        size: item.size || null,
      })

      stockUpdates.push({
        id: product.id,
        type: specId ? 'spec' : 'product',
        specId,
        quantity: item.quantity
      })
    }

    const tax = subtotal * 0.10 // 10% tax
    const total = subtotal + tax

    // Transaction to create order and decrement stock
    const result = await db.$transaction(async (tx) => {
      // Re-verify stock inside transaction to prevent negative stock from race conditions
      for (const update of stockUpdates) {
        if (update.type === 'product') {
          const p = await tx.product.findUnique({ where: { id: update.id } })
          if (!p || p.quantity < update.quantity) throw new Error(`Insufficient stock for product ${update.id}`)
          await tx.product.update({
            where: { id: update.id },
            data: { quantity: { decrement: update.quantity } }
          })
        } else if (update.type === 'spec' && update.specId) {
          const s = await tx.productSpecification.findUnique({ where: { id: update.specId } })
          if (!s || s.quantity < update.quantity) throw new Error(`Insufficient stock for variant ${update.specId}`)
          await tx.productSpecification.update({
            where: { id: update.specId },
            data: { quantity: { decrement: update.quantity } }
          })
          const p = await tx.product.findUnique({ where: { id: update.id } })
          if (!p || p.quantity < update.quantity) throw new Error(`Insufficient stock for product ${update.id}`)
          await tx.product.update({
            where: { id: update.id },
            data: { quantity: { decrement: update.quantity } }
          })
        }
      }

      const order = await tx.order.create({
        data: {
          userId: dbUser.id,
          subtotal,
          tax,
          total,
          shippingAddress: shippingAddress ?? {},
          items: {
            create: orderItemsData
          }
        }
      })

      // Create notification for the user
      await tx.notification.create({
        data: {
          userId: dbUser.id,
          message: `Your order #${order.id.slice(-8).toUpperCase()} has been placed successfully.`,
          type: 'ORDER_CONFIRMED'
        }
      })

      return order
    })

    return NextResponse.json({ data: result }, { status: 201 })
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
