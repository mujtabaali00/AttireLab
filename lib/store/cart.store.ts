import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string        // keyed by productId-color-size
  productId: string
  name: string
  price: number
  imageUrl: string
  quantity: number
  maxStock: number
  color?: string
  size?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getSubtotal: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const id = `${item.productId}-${item.color || 'none'}-${item.size || 'none'}`
        const currentItems = get().items
        const existingItem = currentItems.find(i => i.id === id)

        if (existingItem) {
          set({
            items: currentItems.map(i =>
              i.id === id
                ? { ...i, quantity: Math.min(i.quantity + item.quantity, i.maxStock) }
                : i
            ),
          })
        } else {
          set({ items: [...currentItems, { ...item, id }] })
        }
      },
      removeItem: (id) => {
        set({ items: get().items.filter(i => i.id !== id) })
      },
      updateQuantity: (id, quantity) => {
        set({
          items: get().items.map(i =>
            i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxStock)) } : i
          ),
        })
      },
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
      getSubtotal: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    { name: 'attirelab-cart' }
  )
)
