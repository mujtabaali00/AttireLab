import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OrdersTable, OrderRow, DBOrderStatus } from '@/components/orders/OrdersTable'

export const metadata = { title: 'Orders' }

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const orders = await db.order.findMany({
    where: { userId: session.user.id },
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' }
  })

  const orderRows: OrderRow[] = orders.map(order => ({
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    itemsCount: order.items.length,
    total: Number(order.total),
    status: order.status as DBOrderStatus
  }))

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-2xl tracking-tight transition-colors">
          <span className="mr-3 font-normal">&larr;</span> Orders
        </Link>
      </div>

      <OrdersTable orders={orderRows} isAdmin={false} />
    </div>
  )
}
