'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Map UI Statuses to DB Statuses
// DB Enum: PENDING, PROCESSING, SHIPPED, DELIVERED, CANCELLED
// UI Strings: In Progress (PROCESSING), Dispatched (SHIPPED), Delivered (DELIVERED), Rejected (CANCELLED)

export type DBOrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export interface OrderRow {
  id: string
  createdAt: string
  itemsCount: number
  total: number
  status: DBOrderStatus
  userName?: string
}

interface OrdersTableProps {
  orders: OrderRow[]
  isAdmin?: boolean
}

const statusMap: Record<DBOrderStatus, { label: string, color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  PROCESSING: { label: 'In Progress', color: 'bg-yellow-400 text-white' }, // match UI screenshot yellow
  SHIPPED: { label: 'Dispatched', color: 'bg-blue-500 text-white' }, // match UI screenshot blue
  DELIVERED: { label: 'Delivered', color: 'bg-green-500 text-white' }, // match UI screenshot green
  CANCELLED: { label: 'Rejected', color: 'bg-red-500 text-white' } // match UI screenshot red
}

export function OrdersTable({ orders, isAdmin = false }: OrdersTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Pagination (simple client side for now)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(orders.length / itemsPerPage))
  const paginatedOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className={`bg-white flex flex-col min-h-[60vh] ${isAdmin ? 'rounded-lg shadow-sm border border-gray-100' : ''}`}>

      {/* Table */}
      <div className="overflow-x-auto flex-grow">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Date</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Order #</th>
              {isAdmin && (
                <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">User</th>
              )}
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Number of Product(s)</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Amount</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Order Status</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedOrders.map(order => {
              const statusInfo = statusMap[order.status]
              const displayDate = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
              const orderNum = order.id.slice(-6).toUpperCase()

              return (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{displayDate}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 font-mono whitespace-nowrap">#{orderNum}</td>
                  {isAdmin && (
                    <td className="px-5 py-4 text-sm text-gray-900 whitespace-nowrap">{order.userName}</td>
                  )}
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{order.itemsCount}</td>
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">Rs {Number(order.total).toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm whitespace-nowrap">
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        {updatingId === order.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : order.status === 'DELIVERED' ? (
                          <span
                            title="Delivered orders can no longer be changed"
                            className={`inline-flex px-3 py-1.5 text-xs font-medium rounded cursor-not-allowed ${statusInfo.color}`}
                          >
                            {statusInfo.label}
                          </span>
                        ) : (
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={updatingId === order.id}
                            className={`text-xs font-medium px-2 py-1.5 rounded outline-none border-none cursor-pointer ${statusInfo.color}`}
                          >
                            <option value="PENDING" className="bg-white text-gray-900">Pending</option>
                            <option value="PROCESSING" className="bg-white text-gray-900">In Progress</option>
                            <option value="SHIPPED" className="bg-white text-gray-900">Dispatched</option>
                            <option value="DELIVERED" className="bg-white text-gray-900">Delivered</option>
                            <option value="CANCELLED" className="bg-white text-gray-900">Rejected</option>
                          </select>
                        )}
                      </div>
                    ) : (
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Link
                      href={isAdmin ? `/admin/orders/${order.id}` : `/orders/${order.id}`}
                      className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
                      title="View Details"
                    >
                      <ArrowUpRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              )
            })}

            {paginatedOrders.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="px-5 py-8 text-center text-sm text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 mt-auto">
        <span className="text-sm text-gray-500">
          {orders.length} Total Count
        </span>

        {orders.length > 0 && (
          <div className="flex items-center border border-gray-200 rounded divide-x divide-gray-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm transition-colors ${currentPage === page
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-blue-500 hover:bg-gray-50'
                    }`}
                >
                  {page}
                </button>
              )
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
