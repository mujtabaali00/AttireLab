import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { logger } from '@/lib/logger'
import { ProductStatus } from '@prisma/client'

interface CartItemInput {
  productId: string
  quantity: number
  specificationId?: string | null
}

interface OrderItemPayload {
  productId: string
  specificationId: string | null
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

    // Ensure all items are actually in the user's DB cart (where stock is reserved)
    const userCart = await db.cart.findFirst({ 
      where: { userId: dbUser.id },
      include: { items: true }
    })
    
    if (!userCart) {
      return NextResponse.json({ error: 'Cart session not found or expired. Please re-add items.' }, { status: 400 })
    }

    for (const item of items) {
      const cartItem = userCart.items.find(i =>
        i.productId === item.productId &&
        i.specificationId === (item.specificationId || null)
      )
      if (!cartItem || cartItem.quantity < item.quantity) {
        return NextResponse.json({ error: `Please refresh your cart. Some items were not properly reserved.` }, { status: 400 })
      }
    }

    // Fetch products to verify stock and price
    const productIds = items.map(i => i.productId)
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
      },
      include: { specifications: true }
    })

    let subtotal = 0
    const orderItemsData: OrderItemPayload[] = []

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return NextResponse.json({ error: `Product not found or unavailable: ${item.productId}` }, { status: 404 })
      }

      // Determine price/variant based on specificationId — stock already reserved in cart
      let itemPrice = Number(product.price)
      let color: string | null = null
      let size: string | null = null

      if (item.specificationId) {
        const spec = product.specifications.find(s => s.id === item.specificationId)
        if (!spec) {
          return NextResponse.json({ error: `Product variant is no longer available` }, { status: 404 })
        }
        itemPrice = spec.price ? Number(spec.price) : itemPrice
        color = spec.color
        size = spec.size
      }

      subtotal += itemPrice * item.quantity
      orderItemsData.push({
        productId: product.id,
        specificationId: item.specificationId || null,
        productName: product.name,
        unitPrice: itemPrice,
        quantity: item.quantity,
        color,
        size,
      })
    }

    const tax = subtotal * 0.10 // 10% tax
    const total = subtotal + tax

    // Transaction to create order and clear reserved items from cart
    const result = await db.$transaction(async (tx) => {
      // Clear ordered items from the cart so they don't eventually expire and restore stock
      for (const item of items) {
        await tx.cartItem.deleteMany({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            specificationId: item.specificationId || null
          }
        })
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

      // Notify all admins
      const admins = await tx.user.findMany({ where: { role: 'ADMIN' } })
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            message: `New order #${order.id.slice(-8).toUpperCase()} placed by ${dbUser.name || 'a customer'}.`,
            type: 'ORDER_CONFIRMED'
          }))
        })
      }

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
