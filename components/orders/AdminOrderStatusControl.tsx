'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getAllowedNextStatuses, ORDER_STATUS_LABELS, ORDER_STATUS_SOFT_COLOR } from '@/lib/order-status'

export type DBOrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

export function AdminOrderStatusControl({ orderId, status }: { orderId: string; status: DBOrderStatus }) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const statusInfo = { label: ORDER_STATUS_LABELS[status], color: ORDER_STATUS_SOFT_COLOR[status] }

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

  const selectableStatuses = Array.from(new Set([status, ...getAllowedNextStatuses(status)]))

  return (
    <div className="flex items-center gap-2">
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : (
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isUpdating}
          title="Change order status"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border outline-none cursor-pointer ${statusInfo.color}`}
        >
          {selectableStatuses.map(s => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
        </select>
      )}
    </div>
  )
}
