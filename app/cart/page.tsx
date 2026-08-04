'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, Minus, X } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'

export default function CartPage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  
  const { items, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore()
  
  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [address, setAddress] = useState('')
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const subtotal = getSubtotal()
  const tax = subtotal * 0.10
  const total = subtotal + tax

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      removeItem(itemToDelete)
      setItemToDelete(null)
    }
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPlacingOrder(true)
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shippingAddress: { address }
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to place order')
      }

      setToastMessage('Awesome, Your order has been placed successfully.')
      clearCart()
      setShowAddressModal(false)
      
      // Redirect to orders page after short delay
      setTimeout(() => {
        router.push('/orders')
      }, 2000)

    } catch (error: any) {
      alert(error.message)
    } finally {
      setIsPlacingOrder(false)
    }
  }

  if (items.length === 0 && !toastMessage) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Your cart is empty</h2>
        <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-md transition-colors">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-100 max-w-6xl mx-auto relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 right-4 bg-green-100 text-green-800 px-4 py-3 rounded shadow-md flex items-center justify-between z-50">
          <span className="text-sm font-medium">{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="ml-4 text-green-800 hover:text-green-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" /> Your Shopping Bag
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500">
              <th className="pb-4 font-normal">Product</th>
              <th className="pb-4 font-normal">Color</th>
              <th className="pb-4 font-normal">Size</th>
              <th className="pb-4 font-normal">Qty</th>
              <th className="pb-4 font-normal">Price</th>
              <th className="pb-4 font-normal">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id} className="text-sm">
                <td className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative w-16 h-16 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900 max-w-[200px] line-clamp-2">{item.name}</span>
                  </div>
                </td>
                <td className="py-4 text-gray-600 capitalize">{item.color || '-'}</td>
                <td className="py-4 text-gray-600 uppercase">{item.size || '-'}</td>
                <td className="py-4">
                  <div className="inline-flex items-center border border-gray-200 rounded-md bg-white">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center font-medium text-gray-900">
                      {item.quantity.toString().padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-4 font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</td>
                <td className="py-4">
                  <button
                    onClick={() => setItemToDelete(item.id)}
                    className="text-red-500 hover:text-red-600 p-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-end">
        <div className="w-full sm:w-72 space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Sub Total:</span>
            <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax (10%):</span>
            <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-gray-900 pt-3 border-t border-gray-100">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowAddressModal(true)}
            className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-md transition-colors"
          >
            Place Order
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
            <h3 className="text-xl font-medium text-blue-500 mb-2">Remove Product</h3>
            <div className="text-yellow-500 flex justify-center mb-4">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900 mb-6">Are You Sure You Want To Delete The Item!</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-6 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-50 font-medium"
              >
                No
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-medium text-gray-900 mb-4">Shipping Address</h3>
            <form onSubmit={handlePlaceOrder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Address
                </label>
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="123 Main St, City, Country"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
                  disabled={isPlacingOrder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPlacingOrder}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium disabled:opacity-50"
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
