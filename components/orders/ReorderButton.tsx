'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'

interface ReorderButtonProps {
  orderId: string
}

export function ReorderButton({ orderId }: ReorderButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleReorder = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-order items.')
      }

      toast.success('All items added back to your cart!')
      router.push('/cart')
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during re-ordering.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading}
      className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Re-ordering...' : 'Re-order & Modify Cart'}
    </button>
  )
}
