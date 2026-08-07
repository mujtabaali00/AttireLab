import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
    itemsCount: order.items.reduce((acc, item) => acc + item.quantity, 0),
    total: Number(order.total),
    status: order.status as DBOrderStatus
  }))

  return (
    <div>
      {/* Title */}
      <div className="mb-5">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-semibold text-lg">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> My Orders
        </Link>
      </div>

      <OrdersTable orders={orderRows} isAdmin={false} />
    </div>
  )
}
