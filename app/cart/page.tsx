'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, Minus, X } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'

// Simple color → hex map for the color dot
const COLOR_MAP: Record<string, string> = {
  beige: '#d4b896', white: '#f5f5f5', black: '#1a1a1a', grey: '#9e9e9e',
  'dark grey': '#616161', blue: '#1565c0', 'light blue': '#90caf9',
  'washed blue': '#6fa8dc', 'off-white': '#ece8e1',
}

function ColorDot({ color }: { color?: string }) {
  if (!color) return <span className="text-gray-400 text-xs">-</span>
  const hex = COLOR_MAP[color.toLowerCase()] ?? '#ccc'
  return (
    <span
      className="inline-block w-5 h-5 rounded-full border border-gray-200 shrink-0"
      style={{ backgroundColor: hex }}
      title={color}
    />
  )
}

export default function CartPage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore()

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [address, setAddress] = useState('')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const subtotal = getSubtotal()
  const tax = subtotal * 0.10
  const total = subtotal + tax

  const handleDeleteConfirm = () => {
    if (itemToDelete) { removeItem(itemToDelete); setItemToDelete(null) }
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPlacingOrder(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, shippingAddress: { address } })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to place order')
      }
      clearCart()
      setShowAddressModal(false)
      setToastMessage('Awesome, Your order has been placed successfully.')
      setTimeout(() => { router.push('/orders') }, 2000)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred'
      alert(msg)
    } finally {
      setIsPlacingOrder(false)
    }
  }

  if (items.length === 0 && !toastMessage) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <h2 className="text-xl font-semibold text-gray-800">Your cart is empty</h2>
        <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded transition-colors text-sm">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 relative">
      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-100 text-green-800 px-4 py-2.5 rounded shadow-md flex items-center gap-3 text-sm font-medium max-w-[90vw]">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="text-green-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Title */}
        <div className="mb-5">
          <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-semibold text-lg">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Your Shopping Bag
          </Link>
        </div>

        {/* Table — horizontal scroll on mobile */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[560px] px-4 sm:px-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-400">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium text-center w-10">Color</th>
                  <th className="pb-3 font-medium text-center w-10">Size</th>
                  <th className="pb-3 font-medium text-center w-24">Qty</th>
                  <th className="pb-3 font-medium text-right w-20">Price</th>
                  <th className="pb-3 font-medium text-center w-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className="text-xs sm:text-sm">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-12 h-12 bg-gray-50 rounded overflow-hidden shrink-0">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="48px" />
                          ) : <div className="w-full h-full bg-gray-200" />}
                        </div>
                        <span className="text-gray-700 font-medium line-clamp-2 leading-tight max-w-[160px]">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex justify-center">
                        <ColorDot color={item.color} />
                      </div>
                    </td>
                    <td className="py-3 text-center text-gray-600 uppercase text-xs">
                      {item.size ?? '-'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-center border border-gray-200 rounded w-fit mx-auto">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 text-blue-500">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-medium text-gray-900">
                          {item.quantity.toString().padStart(2, '0')}
                        </span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 text-blue-500">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </td>
                    <td className="py-3 text-center">
                      <button onClick={() => setItemToDelete(item.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sub Total:</span>
              <span className="font-semibold text-gray-900">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax:</span>
              <span className="font-semibold text-gray-900">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setShowAddressModal(true)}
              className="w-full mt-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-medium py-3 rounded transition-colors text-sm"
            >
              Place Order
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs text-center shadow-xl">
            <h3 className="text-lg font-semibold text-blue-500 mb-1">Remove Product</h3>
            <div className="flex justify-center my-4">
              <svg className="w-14 h-14 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-5">
              Are You Sure You Want To Delete The Item!
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-6 py-2 border border-blue-500 text-blue-500 rounded text-sm font-medium hover:bg-blue-50"
              >
                No
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-6 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Shipping Address</h3>
            <form onSubmit={handlePlaceOrder}>
              <textarea
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                rows={3}
                placeholder="123 Main St, City, Country"
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  disabled={isPlacingOrder}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPlacingOrder}
                  className="px-4 py-2 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {isPlacingOrder ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
