import { create } from 'zustand'

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  imageUrl: string
  quantity: number
  maxStock: number // Used mostly for UI limits now
  color?: string
  size?: string
}

interface CartStore {
  items: CartItem[]
  expiresAt: string | null
  isLoading: boolean
  isInitialized: boolean
  fetchCart: () => Promise<void>
  addItem: (item: Omit<CartItem, 'id' | 'maxStock'>) => Promise<void>
  removeItem: (id: string) => Promise<void>
  updateQuantity: (id: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  getTotalItems: () => number
  getSubtotal: () => number
}

// Shape of the JSON payload returned by /api/cart (getCart() in lib/cart.ts,
// serialized over the wire — Decimal fields arrive as strings, dates as ISO strings).
interface CartApiSpecification {
  color: string | null
  size: string | null
  price: string | number | null
  imageUrl: string | null
}

interface CartApiProduct {
  status: string
  name: string
  price: string | number
  images: { url: string }[]
  specifications: CartApiSpecification[]
}

interface CartApiItem {
  id: string
  productId: string
  quantity: number
  color: string | null
  size: string | null
  product: CartApiProduct
}

interface CartApiResponse {
  items: CartApiItem[]
  expiresAt: string | null
}

// Convert DB Cart to our frontend state format
const mapDbCartToState = (dbCart: CartApiResponse | null): { items: CartItem[], expiresAt: string | null } => {
  if (!dbCart) return { items: [], expiresAt: null }

  const items = dbCart.items
    .filter(item => item.product?.status === 'ACTIVE')
    .map(item => {
      const matchingSpec = item.product.specifications?.find(s => s.color === item.color && s.size === item.size)
      return {
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        price: Number(matchingSpec?.price ?? item.product.price),
        imageUrl: matchingSpec?.imageUrl || item.product.images[0]?.url || '',
        quantity: item.quantity,
        maxStock: 99, // Backend enforces actual stock limits now
        color: item.color || undefined,
        size: item.size || undefined,
      }
    })

  return { items, expiresAt: dbCart.expiresAt }
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  expiresAt: null,
  isLoading: false,
  isInitialized: false,

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/cart')
      const data = await res.json()
      if (res.ok && data.data) {
        const { items, expiresAt } = mapDbCartToState(data.data)
        set({ items, expiresAt, isInitialized: true })
      } else {
        set({ items: [], expiresAt: null, isInitialized: true })
      }
    } catch {
      set({ items: [], expiresAt: null, isInitialized: true })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (item) => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add item')
      
      const { items, expiresAt } = mapDbCartToState(data.data)
      set({ items, expiresAt })
    } catch (error) {
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  removeItem: async (id) => {
    set({ isLoading: true })
    try {
      const res = await fetch(`/api/cart?itemId=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove item')
      
      const { items, expiresAt } = mapDbCartToState(data.data)
      set({ items, expiresAt })
    } catch (error) {
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  updateQuantity: async (id, quantity) => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id, quantity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update quantity')
      
      const { items, expiresAt } = mapDbCartToState(data.data)
      set({ items, expiresAt })
    } catch (error) {
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  clearCart: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch('/api/cart', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to clear cart')
      
      const { items, expiresAt } = mapDbCartToState(data.data)
      set({ items, expiresAt })
    } catch (error) {
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
  getSubtotal: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
}))
