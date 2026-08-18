import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { OrdersTable, OrderRow, DBOrderStatus } from '@/components/orders/OrdersTable'
import { ClipboardList, Box, DollarSign } from 'lucide-react'

export const metadata = { title: 'Manage Orders' }

export default async function AdminOrdersPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/auth/login')

  const orders = await db.order.findMany({
    include: {
      items: true,
      user: { select: { name: true, id: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Calculate metrics
  const totalOrders = orders.length
  let totalUnits = 0
  let totalAmount = 0

  orders.forEach(order => {
    totalAmount += Number(order.total)
    order.items.forEach(item => {
      totalUnits += item.quantity
    })
  })

  const orderRows: OrderRow[] = orders.map(order => ({
    id: order.id,
    createdAt: order.createdAt.toISOString(),
    itemsCount: order.items.reduce((acc, item) => acc + item.quantity, 0),
    total: Number(order.total),
    status: order.status as DBOrderStatus,
    userName: order.user.name || 'Guest'
  }))

  return (
    <div className="p-6 lg:p-8">
      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Orders:</p>
            <h2 className="text-2xl font-bold text-blue-600">{totalOrders}</h2>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Units:</p>
            <h2 className="text-2xl font-bold text-blue-600">{totalUnits}</h2>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <Box className="w-6 h-6 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Amount:</p>
            <h2 className="text-2xl font-bold text-blue-600">Rs {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-blue-500" />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Orders</h2>
      </div>

      <OrdersTable orders={orderRows} isAdmin={true} />
    </div>
  )
}
