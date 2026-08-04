import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const orders = await db.order.findMany({
    where: session.user.role === 'ADMIN' ? {} : { userId: session.user.id },
    include: {
      _count: { select: { items: true } },
      user: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-100 max-w-6xl mx-auto">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-lg">
          <ArrowLeft className="w-5 h-5 mr-2" /> Orders
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500">
              <th className="pb-4 font-normal">Date</th>
              <th className="pb-4 font-normal">Order #</th>
              <th className="pb-4 font-normal">User</th>
              <th className="pb-4 font-normal">Product(s)</th>
              <th className="pb-4 font-normal">Amount</th>
              <th className="pb-4 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id} className="text-sm">
                <td className="py-4 text-gray-600">
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </td>
                <td className="py-4 text-gray-600">{order.id.slice(-6).toUpperCase()}</td>
                <td className="py-4 text-gray-600">{order.user.name}</td>
                <td className="py-4 text-gray-600">{order._count.items.toString().padStart(2, '0')}</td>
                <td className="py-4 text-gray-600">${Number(order.total).toFixed(2)}</td>
                <td className="py-4">
                  <Link href={`/orders/${order.id}`} className="text-gray-400 hover:text-gray-600 inline-block p-1">
                    <ArrowUpRight className="w-5 h-5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No orders found.
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-8 flex justify-between items-center text-sm text-gray-500">
          <span>{orders.length} Total Count</span>
          <div className="flex space-x-2">
            <button className="text-blue-500 hover:underline disabled:opacity-50" disabled>Previous</button>
            <button className="text-blue-500 font-medium">1</button>
            <button className="text-blue-500 hover:underline disabled:opacity-50" disabled>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
