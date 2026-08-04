import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

export const metadata = { title: 'Orders' }

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const orders = await db.order.findMany({
    where: session.user.role === 'ADMIN' ? {} : { userId: session.user.id },
    include: {
      _count: { select: { items: true } },
      user: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <div className="mb-5">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-semibold text-lg">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Orders
        </Link>
      </div>

      {/* Table with horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[520px] px-4 sm:px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-400">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Order #</th>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium text-center">Product(s)</th>
                <th className="pb-3 font-medium text-right">Amount</th>
                <th className="pb-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.id} className="text-xs sm:text-sm">
                  <td className="py-3 text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </td>
                  <td className="py-3 text-gray-600 font-mono text-xs">
                    {order.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="py-3 text-gray-600">{order.user.name}</td>
                  <td className="py-3 text-gray-600 text-center">
                    {order._count.items.toString().padStart(2, '0')}
                  </td>
                  <td className="py-3 text-gray-900 font-medium text-right">
                    ${Number(order.total).toFixed(2)}
                  </td>
                  <td className="py-3 text-center">
                    <Link href={`/orders/${order.id}`} className="text-gray-400 hover:text-gray-700 inline-block p-1">
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No orders found.</div>
      )}

      {orders.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-500">
          <span>{orders.length} Total Count</span>
          <div className="flex items-center space-x-2">
            <button className="text-blue-500 hover:underline disabled:opacity-40 text-xs" disabled>Previous</button>
            <button className="text-blue-500 font-bold text-xs border border-blue-500 w-6 h-6 rounded flex items-center justify-center">1</button>
            <button className="text-blue-500 hover:underline disabled:opacity-40 text-xs" disabled>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
