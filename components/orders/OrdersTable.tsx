'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getAllowedNextStatuses, ORDER_STATUS_LABELS, ORDER_STATUS_SOLID_COLOR } from '@/lib/order-status'
import { formatPrice } from '@/lib/format'
import { TablePagination } from '@/components/ui/TablePagination'

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

export function OrdersTable({ orders, isAdmin = false }: OrdersTableProps) {
  const router = useRouter()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(order =>
      order.id.slice(-6).toLowerCase().includes(q) ||
      (order.userName ?? '').toLowerCase().includes(q)
    )
  }, [orders, searchQuery])

  // Pagination (simple client side for now)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage))
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        router.refresh()
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
    <div className="bg-white flex flex-col min-h-[60vh] rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      {isAdmin && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order # or customer..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
            />
          </div>
        </div>
      )}

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
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Number of Products</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Amount</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">Order Status</th>
              <th className="px-5 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedOrders.map(order => {
              const statusInfo = { label: ORDER_STATUS_LABELS[order.status], color: ORDER_STATUS_SOLID_COLOR[order.status] }
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
                  <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">Rs {formatPrice(Number(order.total))}</td>
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
                            title="Change order status"
                            className={`text-xs font-medium px-2 py-1.5 rounded outline-none border-none cursor-pointer ${statusInfo.color}`}
                          >
                            {Array.from(new Set([order.status, ...getAllowedNextStatuses(order.status)])).map(s => (
                              <option key={s} value={s} className="bg-white text-gray-900">{ORDER_STATUS_LABELS[s]}</option>
                            ))}
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

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={filteredOrders.length}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
