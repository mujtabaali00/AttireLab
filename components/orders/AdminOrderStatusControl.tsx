'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

export type DBOrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

const statusMap: Record<DBOrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  PROCESSING: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  SHIPPED: { label: 'Dispatched', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' },
}

export function AdminOrderStatusControl({ orderId, status }: { orderId: string; status: DBOrderStatus }) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const statusInfo = statusMap[status]

  if (status === 'DELIVERED') {
    return (
      <div>
        <span
          title="Delivered orders can no longer be changed"
          className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full border cursor-not-allowed ${statusInfo.color}`}
        >
          {statusInfo.label}
        </span>
        <p className="text-xs text-gray-400 mt-2">This order has been delivered and its status is locked.</p>
      </div>
    )
  }

  const handleChange = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update status')
        return
      }
      toast.success('Order status updated')
      router.refresh()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : (
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isUpdating}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border outline-none cursor-pointer ${statusInfo.color}`}
        >
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">In Progress</option>
          <option value="SHIPPED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      )}
    </div>
  )
}
