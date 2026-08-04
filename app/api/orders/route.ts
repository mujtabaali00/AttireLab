import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/auth'

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
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      where: { id: { in: productIds } }
    })

    let subtotal = 0
    const orderItemsData: OrderItemPayload[] = []

    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 404 })
      }
      if (product.quantity < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}` }, { status: 409 })
      }

      subtotal += Number(product.price) * item.quantity
      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.price),
        quantity: item.quantity,
        color: item.color ?? null,
        size: item.size ?? null,
      })
    }

    const tax = subtotal * 0.10 // 10% tax
    const total = subtotal + tax

    // Transaction to create order and decrement stock
    const result = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: session.user.id,
          subtotal,
          tax,
          total,
          shippingAddress: shippingAddress ?? {},
          items: {
            create: orderItemsData
          }
        }
      })

      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity }
          }
        })
      }

      return order
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await db.order.findMany({
      where: session.user.role === 'ADMIN' ? {} : { userId: session.user.id },
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
