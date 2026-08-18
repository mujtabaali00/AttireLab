'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, Minus, X, ShoppingBag, CheckCircle } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'

export default function CartPage() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { data: session, status } = useSession()

  const { items, expiresAt, updateQuantity, removeItem, clearCart, getSubtotal } = useCartStore()

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [address, setAddress] = useState('')
  const [recentAddresses, setRecentAddresses] = useState<string[]>([])
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  // Auto-open address modal if user just came back from login (session present + cart not empty)
  useEffect(() => {
    if (session && mounted && items.length > 0) {
      // Check if they were redirected back from login
      const fromLogin = typeof window !== 'undefined' && document.referrer.includes('/auth/')
      if (fromLogin) {
        setShowAddressModal(true)
      }
    }
  }, [session, mounted, items.length])

  // Load recent addresses from local storage
  useEffect(() => {
    if (mounted) {
      try {
        const stored = localStorage.getItem('attirelab_recent_addresses')
        if (stored) setRecentAddresses(JSON.parse(stored).slice(0, 3))
      } catch {}
    }
  }, [mounted])

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null)
      return
    }
    const interval = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        clearInterval(interval)
        // Let the store handle fetchCart to refresh if it's expired
      } else {
        const mins = Math.floor(diff / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (!mounted || status === 'loading') return null

  const subtotal = getSubtotal()
  const tax = subtotal * 0.10
  const total = subtotal + tax

  const handleDeleteConfirm = () => {
    if (itemToDelete) { removeItem(itemToDelete); setItemToDelete(null) }
  }

  const formatCartError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to update quantity'
    return message.includes('Only 0 items left in stock')
      ? 'This item is out of stock.'
      : message
  }

  const handleQuantityChange = async (itemId: string, quantity: number) => {
    try {
      await updateQuantity(itemId, quantity)
    } catch (error) {
      toast.error(formatCartError(error))
    }
  }

  const handlePlaceOrderClick = () => {
    if (!session) {
      // Not logged in — redirect to login with callbackUrl=/cart
      router.push('/auth/login?callbackUrl=/cart')
      return
    }
    // Logged in — open address modal directly
    setShowAddressModal(true)
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPlacingOrder(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, specificationId: i.specificationId, quantity: i.quantity })),
          shippingAddress: { address },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to place order')
      }
      
      const newAddresses = [address, ...recentAddresses.filter(a => a !== address)].slice(0, 3)
      setRecentAddresses(newAddresses)
      localStorage.setItem('attirelab_recent_addresses', JSON.stringify(newAddresses))

      clearCart()
      setShowAddressModal(false)
      const data = await res.json()
      const orderId = data.data?.id

      setPlacedOrderId(orderId || null)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'An error occurred'
      toast.error(msg)
    } finally {
      setIsPlacingOrder(false)
    }
  }

  if (placedOrderId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center shadow-xl border border-gray-100">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Order placed successfully!</h3>
          <p className="text-sm text-gray-500 mb-6">We&apos;ve received your order and will start processing it right away.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push(`/orders/${placedOrderId}`)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              View Order Details
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <ShoppingBag className="w-16 h-16 text-gray-200" />
        <h2 className="text-xl font-semibold text-gray-800">Your cart is empty</h2>
        <p className="text-sm text-gray-500">Add some items to get started</p>
        <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors text-sm">
          Continue Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 relative">
      <div>
        {/* Title & Timer */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-[28px] tracking-tight transition-colors">
            <span className="mr-3 font-normal">&larr;</span> Shopping Bag
          </Link>
          
          <div className="flex items-center gap-4">
            {timeLeft && (
              <div className="text-xs font-semibold bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full border border-orange-100 shadow-sm flex items-center">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                Stock reserved for: {timeLeft}
              </div>
            )}
            <button
              onClick={() => setItemToDelete('__all__')}
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="sm:hidden space-y-3">
          {items.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-3 flex gap-3">
              <div className="relative w-14 h-14 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="56px" />
                ) : <div className="w-full h-full bg-gray-200" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
                  <button onClick={() => setItemToDelete(item.id)} className="text-red-400 hover:text-red-600 p-1 -mr-1 -mt-1 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {(item.color || item.size) && (
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {[item.color && `Color: ${item.color}`, item.size && `Size: ${item.size.toUpperCase()}`].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-gray-200 rounded-lg bg-white">
                    <button onClick={() => item.quantity <= 1 ? setItemToDelete(item.id) : handleQuantityChange(item.id, item.quantity - 1)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-l-lg transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-semibold text-gray-900">
                      {String(item.quantity).padStart(2, '0')}
                    </span>
                    <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-r-lg transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">Rs {(item.price * item.quantity).toLocaleString()}</span>
                    {item.quantity > 1 && (
                      <p className="text-[11px] text-gray-400">Rs {item.price.toLocaleString()} each</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* sm+: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-400 bg-gray-50/50">
                  <th className="pl-6 py-3 font-medium">Product</th>
                  <th className="py-3 font-medium text-center">Color</th>
                  <th className="py-3 font-medium text-center">Size</th>
                  <th className="py-3 font-medium text-center w-28">Qty</th>
                  <th className="py-3 font-medium text-center">Price</th>
                  <th className="py-3 font-medium text-center whitespace-nowrap">Total Price</th>
                  <th className="py-3 font-medium text-center w-16">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => (
                  <tr key={item.id} className="text-xs sm:text-sm hover:bg-gray-50/30 transition-colors">
                    <td className="py-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="40px" />
                          ) : <div className="w-full h-full bg-gray-200" />}
                        </div>
                        <span className="text-gray-700 font-medium line-clamp-2 leading-tight max-w-[200px]">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      {item.color ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full border border-gray-200" style={{ backgroundColor: item.color }} />
                          <span className="capitalize text-gray-600">{item.color}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 text-center text-gray-600">
                      {item.size ? (
                         <span className="uppercase">{item.size}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center justify-center border border-gray-200 rounded-lg w-fit mx-auto bg-white">
                        <button onClick={() => item.quantity <= 1 ? setItemToDelete(item.id) : handleQuantityChange(item.id, item.quantity - 1)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-l-lg transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold text-gray-900">
                          {String(item.quantity).padStart(2, '0')}
                        </span>
                        <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-r-lg transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-center text-gray-600 whitespace-nowrap">
                      Rs {item.price.toLocaleString()}
                    </td>
                    <td className="py-4 text-center font-semibold text-gray-900 whitespace-nowrap">
                      Rs {(item.price * item.quantity).toLocaleString()}
                    </td>
                    <td className="py-4 text-center">
                      <button onClick={() => setItemToDelete(item.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        </div>

        {/* Totals + Checkout */}
        <div className="mt-6 flex justify-end">
          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Sub Total:</span>
              <span className="font-semibold text-gray-900">Rs {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax (10%):</span>
              <span className="font-semibold text-gray-900">Rs {tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total:</span>
              <span>Rs {total.toLocaleString()}</span>
            </div>
            <button
              onClick={handlePlaceOrderClick}
              className="w-full mt-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              {session ? 'Place Order' : 'Login to Checkout'}
            </button>
            {!session && (
              <p className="text-xs text-center text-gray-400">
                You&apos;ll be redirected to login, then brought back here.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs text-center shadow-xl">
            <h3 className="text-lg font-semibold text-blue-500 mb-1">Remove Item</h3>
            <div className="flex justify-center my-4">
              <svg className="w-14 h-14 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-5">
              {itemToDelete === '__all__' ? 'Clear all items from your cart?' : 'Remove this item from your cart?'}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setItemToDelete(null)} className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (itemToDelete === '__all__') { clearCart(); setItemToDelete(null) }
                  else handleDeleteConfirm()
                }}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Shipping Address</h3>
              <button onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePlaceOrder}>
              <textarea
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none"
                rows={4}
                placeholder="Enter your full shipping address&#10;e.g. 123 Main St, Karachi, Pakistan"
                autoFocus
              />
              
              {recentAddresses.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Recent Addresses:</p>
                  <div className="space-y-2">
                    {recentAddresses.map((addr, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAddress(addr)}
                        className="w-full text-left text-xs bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-md p-2 transition-colors truncate"
                        title={addr}
                      >
                        {addr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  disabled={isPlacingOrder}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPlacingOrder}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 disabled:opacity-50"
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
