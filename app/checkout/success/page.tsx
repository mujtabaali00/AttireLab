'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Package } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'

export default function CheckoutSuccessPage() {
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const clearCart = useCartStore(state => state.clearCart)

  const orderId = searchParams.get('order_id')

  useEffect(() => {
    setMounted(true)
    clearCart()
  }, [clearCart])

  if (!mounted) return null

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Order & Payment Successful!</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Thank you for your purchase. Your order has been placed and is currently being processed.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={orderId ? `/orders/${orderId}` : '/orders'}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <Package className="w-5 h-5" />
            {orderId ? 'View Order Details' : 'View My Orders'}
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
