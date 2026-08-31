'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2, Plus, Minus, X, ShoppingBag, CheckCircle, Loader2, Trash } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { formatPrice } from '@/lib/format'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

export default function CartPage() {
  return (
    <Suspense fallback={null}>
      <CartPageContent />
    </Suspense>
  )
}

function CartPageContent() {
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()

  const { items, expiresAt, updateQuantity, removeItem, clearCart, getSubtotal, fetchCart } = useCartStore()
  const [isCartLoading, setIsCartLoading] = useState(true)

  const [itemToDelete, setItemToDelete] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [address, setAddress] = useState('')
  const [recentAddresses, setRecentAddresses] = useState<string[]>([])
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-mount flag, not derived state
  useEffect(() => { setMounted(true) }, [])

  // Always re-fetch on mount instead of trusting whatever's already sitting in
  // the store. The store is populated by Navbar's own independent fetchCart()
  // call (for the header badge), which may not have resolved yet on a fresh
  // page load — rendering off stale/empty state in that window made the cart
  // look "vanished" for a moment, and made stock-derived UI (like the + button)
  // reflect whatever stale numbers happened to be in memory rather than what's
  // actually in the DB right now (e.g. after an admin changes stock elsewhere).
  useEffect(() => {
    let cancelled = false
    fetchCart().finally(() => { if (!cancelled) setIsCartLoading(false) })
    return () => { cancelled = true }
  }, [fetchCart])

  // Items can disappear from the cart via single-item delete, "Clear all", or
  // stock/expiry changes from the server — without this, selectedIds keeps
  // stale ids around, corrupting the "Delete Selected (N)" count and the
  // "select all" checkbox, and can make a later bulk delete fail partway
  // through trying to delete an item that's already gone.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pruning selection to stay in sync with the cart store, not derived render state
    setSelectedIds(prev => {
      const validIds = new Set(items.map(i => i.id))
      const next = new Set([...prev].filter(id => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [items])

  // Auto-resume checkout if user was sent to login from "Place Order" (session present
  // + cart not empty). Login/register redirect back here client-side (router.push), which
  // never updates document.referrer, so we use an explicit ?checkout=1 flag instead.
  useEffect(() => {
    if (session && mounted && items.length > 0 && searchParams.get('checkout') === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resuming an in-progress checkout, not derived state
      setShowAddressModal(true)
      router.replace('/cart')
    }
  }, [session, mounted, items.length, searchParams, router])

  // Load recent addresses from local storage
  useEffect(() => {
    if (mounted) {
      try {
        const stored = localStorage.getItem('attirelab_recent_addresses')
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external store (localStorage) on mount
        if (stored) setRecentAddresses(JSON.parse(stored).slice(0, 3))
      } catch {}
    }
  }, [mounted])

  useEffect(() => {
    if (!expiresAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing timer display when there's nothing to count down
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

  if (!mounted || status === 'loading' || isCartLoading) return <PageSpinner />

  const subtotal = getSubtotal()
  const tax = subtotal * 0.10
  const total = subtotal + tax

  const handleDeleteConfirm = () => {
    if (itemToDelete) { removeItem(itemToDelete); setItemToDelete(null) }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)))
  }

  const handleBulkDeleteConfirm = async () => {
    setIsBulkDeleting(true)
    try {
      for (const id of selectedIds) {
        await removeItem(id)
      }
      setSelectedIds(new Set())
    } catch (error) {
      toast.error(formatCartError(error))
    } finally {
      setIsBulkDeleting(false)
      setItemToDelete(null)
    }
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
      // Not logged in — redirect to login, flagging that checkout should resume on return
      router.push(`/auth/login?callbackUrl=${encodeURIComponent('/cart?checkout=1')}`)
      return
    }
    // Logged in — open checkout modal
    setShowAddressModal(true)
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
          <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-2xl tracking-tight transition-colors">
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
            {selectedIds.size > 0 && (
              <button
                onClick={() => setItemToDelete('__selected__')}
                title="Delete selected items"
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium bg-red-100 hover:bg-red-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setItemToDelete('__all__')}
              title="Remove all items from cart"
              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 font-medium bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>
        </div>

        {/* Mobile: stacked cards */}
        <div className="sm:hidden space-y-3">
          {items.map(item => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-3 flex gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                title="Select item"
                className="mt-1 w-4 h-4 shrink-0 accent-blue-500 cursor-pointer"
              />
              <div className="relative w-14 h-14 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="56px" />
                ) : <div className="w-full h-full bg-gray-200" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{item.name}</p>
                  <button onClick={() => setItemToDelete(item.id)} title="Remove item" className="text-red-400 hover:text-red-600 p-1 -mr-1 -mt-1 shrink-0">
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
                    <button onClick={() => item.quantity <= 1 ? setItemToDelete(item.id) : handleQuantityChange(item.id, item.quantity - 1)} title="Decrease quantity" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-l-lg transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-semibold text-gray-900">
                      {String(item.quantity).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      disabled={item.maxStock <= 0}
                      title={item.maxStock <= 0 ? 'No more stock available' : 'Increase quantity'}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-r-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">Rs {formatPrice(item.price * item.quantity)}</span>
                    {item.quantity > 1 && (
                      <p className="text-[11px] text-gray-400">Rs {formatPrice(item.price)} each</p>
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
                  <th className="py-3 font-medium w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      title="Select all items"
                      className="w-4 h-4 accent-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 font-medium">Product</th>
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
                    <td className="py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        title="Select item"
                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4">
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
                        <button onClick={() => item.quantity <= 1 ? setItemToDelete(item.id) : handleQuantityChange(item.id, item.quantity - 1)} title="Decrease quantity" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-l-lg transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold text-gray-900">
                          {String(item.quantity).padStart(2, '0')}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          disabled={item.maxStock <= 0}
                          title={item.maxStock <= 0 ? 'No more stock available' : 'Increase quantity'}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-r-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 text-center text-gray-600 whitespace-nowrap">
                      Rs {formatPrice(item.price)}
                    </td>
                    <td className="py-4 text-center font-semibold text-gray-900 whitespace-nowrap">
                      Rs {formatPrice(item.price * item.quantity)}
                    </td>
                    <td className="py-4 text-center">
                      <button onClick={() => setItemToDelete(item.id)} title="Remove item" className="text-red-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer">
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
              <span className="font-semibold text-gray-900">Rs {formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax (10%):</span>
              <span className="font-semibold text-gray-900">Rs {formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>Total:</span>
              <span>Rs {formatPrice(total)}</span>
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
            <h3 className="text-lg font-semibold text-blue-500 mb-1">
              {itemToDelete === '__selected__' ? 'Remove Selected Items' : 'Remove Item'}
            </h3>
            <div className="flex justify-center my-4">
              <svg className="w-14 h-14 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-5">
              {itemToDelete === '__all__'
                ? 'Clear all items from your cart?'
                : itemToDelete === '__selected__'
                  ? `Remove ${selectedIds.size} selected item${selectedIds.size !== 1 ? 's' : ''} from your cart?`
                  : 'Remove this item from your cart?'}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setItemToDelete(null)} disabled={isBulkDeleting} className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 cursor-pointer">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (itemToDelete === '__all__') { clearCart(); setItemToDelete(null) }
                  else if (itemToDelete === '__selected__') { handleBulkDeleteConfirm() }
                  else handleDeleteConfirm()
                }}
                disabled={isBulkDeleting}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 min-w-[88px] cursor-pointer"
              >
                {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address & Stripe Checkout Modal */}
      <StripeCheckoutModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        subtotal={subtotal}
        tax={tax}
        total={total}
        address={address}
        setAddress={setAddress}
        recentAddresses={recentAddresses}
        setRecentAddresses={setRecentAddresses}
        items={items}
        clearCart={clearCart}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Stripe Checkout Modal
// ─────────────────────────────────────────────────────────────
interface StripeCheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  subtotal: number
  tax: number
  total: number
  address: string
  setAddress: (v: string) => void
  recentAddresses: string[]
  setRecentAddresses: (v: string[]) => void
  items: any[]
  clearCart: () => void
}

function StripeCheckoutModal(props: StripeCheckoutModalProps) {
  if (!props.isOpen) return null
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  )
}

interface SavedCard {
  id: string
  brand: string | undefined
  last4: string | undefined
  expMonth: number | undefined
  expYear: number | undefined
}

function CheckoutForm({
  isOpen, onClose, subtotal, tax, total,
  address, setAddress, recentAddresses, setRecentAddresses,
  items, clearCart,
}: StripeCheckoutModalProps) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()

  const [step, setStep] = useState<'address' | 'payment'>('address')
  const [paymentMethodType, setPaymentMethodType] = useState<'CARD' | 'COD'>('CARD')
  const [savedCards, setSavedCards] = useState<SavedCard[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [useNewCard, setUseNewCard] = useState(false)
  const [saveCard, setSaveCard] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingCards, setIsFetchingCards] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && step === 'payment' && paymentMethodType === 'CARD') {
      setIsFetchingCards(true)
      fetch('/api/payment-methods')
        .then(r => r.json())
        .then(d => {
          const cards: SavedCard[] = d.data || []
          setSavedCards(cards)
          if (cards.length > 0) {
            setSelectedCardId(cards[0].id)
            setUseNewCard(false)
          } else {
            setUseNewCard(true)
          }
        })
        .catch(() => setUseNewCard(true))
        .finally(() => setIsFetchingCards(false))
    }
  }, [isOpen, step, paymentMethodType])

  const handleDeleteCard = async (cardId: string) => {
    setDeletingCardId(cardId)
    try {
      const res = await fetch(`/api/payment-methods/${cardId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove card')
      setSavedCards(prev => prev.filter(c => c.id !== cardId))
      if (selectedCardId === cardId) {
        const remaining = savedCards.filter(c => c.id !== cardId)
        if (remaining.length > 0) setSelectedCardId(remaining[0].id)
        else { setSelectedCardId(null); setUseNewCard(true) }
      }
      toast.success('Card removed')
    } catch {
      toast.error('Failed to remove card')
    } finally {
      setDeletingCardId(null)
    }
  }

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setIsLoading(true)
    setPaymentError(null)

    try {
      let paymentMethodId: string | undefined

      if (paymentMethodType === 'CARD') {
        if (useNewCard) {
          const cardEl = elements.getElement(CardElement)
          if (!cardEl) throw new Error('Card element not found')
          const { error, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardEl })
          if (error) { setPaymentError(error.message || 'Card error'); setIsLoading(false); return }
          paymentMethodId = paymentMethod?.id
        } else {
          if (!selectedCardId) { setPaymentError('Please select a card'); setIsLoading(false); return }
          paymentMethodId = selectedCardId
        }
      }

      // Save address to recent list
      const newAddresses = [address, ...recentAddresses.filter(a => a !== address)].slice(0, 3)
      setRecentAddresses(newAddresses)
      localStorage.setItem('attirelab_recent_addresses', JSON.stringify(newAddresses))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, specificationId: i.specificationId, quantity: i.quantity })),
          shippingAddress: { address },
          paymentMethodType,
          paymentMethodId,
          saveCard,
        })
      })

      const data = await res.json()

      if (!res.ok) {
        // Card declined — redirect to failed page
        if (data.orderId) {
          router.push(`/checkout/failed?reason=${encodeURIComponent(data.error || 'Payment failed')}&order_id=${data.orderId}`)
        } else {
          setPaymentError(data.error || 'Payment failed')
        }
        return
      }

      // 3D Secure required
      if (data.data?.requiresAction && data.data?.clientSecret) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.data.clientSecret)
        if (confirmError) {
          setPaymentError(confirmError.message || 'Payment authentication failed')
          return
        }
        clearCart()
        router.push('/checkout/success')
        return
      }

      // Success
      clearCart()
      onClose()
      router.push('/checkout/success')
    } catch (err: any) {
      setPaymentError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {step === 'address' ? 'Shipping Address' : 'Payment Method'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {step === 'address' ? '1' : '2'} of 2
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={step === 'address' ? (e) => { e.preventDefault(); setStep('payment') } : handlePlaceOrder} className="p-5 space-y-4">

          {/* ── Step 1: Address ── */}
          {step === 'address' && (
            <>
              <textarea
                required
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none"
                rows={4}
                placeholder={"Enter your full shipping address\ne.g. 123 Main St, Karachi, Pakistan"}
                autoFocus
              />
              {recentAddresses.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent</p>
                  <div className="space-y-1.5">
                    {recentAddresses.map((addr, i) => (
                      <button key={i} type="button" onClick={() => setAddress(addr)}
                        className="w-full text-left text-xs bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-2.5 transition-colors truncate">
                        {addr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Payment ── */}
          {step === 'payment' && (
            <>
              {/* Order total summary */}
              <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>Rs {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Tax (10%)</span><span>Rs {tax.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200"><span>Total</span><span>Rs {total.toFixed(2)}</span></div>
              </div>

              {/* Payment type toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(['CARD', 'COD'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setPaymentMethodType(type)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${paymentMethodType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {type === 'CARD' ? '💳 Card' : '💵 Cash on Delivery'}
                  </button>
                ))}
              </div>

              {/* Card section */}
              {paymentMethodType === 'CARD' && (
                <div className="space-y-3">
                  {isFetchingCards ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                  ) : (
                    <>
                      {/* Saved cards */}
                      {savedCards.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saved Cards</p>
                          {savedCards.map(card => (
                            <div key={card.id}
                              onClick={() => { setSelectedCardId(card.id); setUseNewCard(false) }}
                              className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-colors ${selectedCardId === card.id && !useNewCard ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                              <div className="flex items-center gap-3">
                                <input type="radio" readOnly checked={selectedCardId === card.id && !useNewCard} className="accent-blue-500" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 capitalize">{card.brand} •••• {card.last4}</p>
                                  <p className="text-xs text-gray-400">Expires {card.expMonth}/{card.expYear}</p>
                                </div>
                              </div>
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id) }}
                                disabled={deletingCardId === card.id}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                                {deletingCardId === card.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* New card toggle */}
                      <button type="button" onClick={() => { setUseNewCard(true); setSelectedCardId(null) }}
                        className={`w-full flex items-center gap-3 p-3 border rounded-xl text-sm font-medium transition-colors ${useNewCard ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-dashed border-gray-300 text-gray-500 hover:border-gray-400'}`}>
                        <input type="radio" readOnly checked={useNewCard} className="accent-blue-500" />
                        + Add New Card
                      </button>

                      {/* Stripe CardElement */}
                      {useNewCard && (
                        <div className="space-y-2">
                          <div className="border border-gray-200 rounded-xl p-3">
                            <CardElement options={{ style: { base: { fontSize: '14px', color: '#111827', '::placeholder': { color: '#9ca3af' } } } }} />
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={saveCard} onChange={e => setSaveCard(e.target.checked)} className="accent-blue-500 w-4 h-4" />
                            <span className="text-xs text-gray-500">Save card for future purchases</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {paymentError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3">
                  {paymentError}
                </div>
              )}
            </>
          )}

          {/* Footer buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button"
              onClick={step === 'address' ? onClose : () => setStep('address')}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              {step === 'address' ? 'Cancel' : 'Back'}
            </button>
            <button type="submit" disabled={isLoading || !stripe}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : step === 'address' ? 'Continue →' : paymentMethodType === 'CARD' ? 'Pay Now' : 'Place Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
