'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { XCircle, ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react'

export default function CheckoutFailedPage() {
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const reason = searchParams.get('reason') || 'Your payment was declined by the card issuer.'
  const orderId = searchParams.get('order_id')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Payment Unsuccessful</h1>
        <p className="text-red-500 font-medium mb-4 text-sm bg-red-50 py-2.5 px-4 rounded-lg inline-block border border-red-100">
          {reason}
        </p>
        
        <p className="text-gray-500 mb-8 max-w-md mx-auto text-sm">
          Do not worry, your cart remains intact. You can retry the payment by going back to your cart and trying a different card or cash on delivery.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/cart"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            Return to Cart & Retry
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
