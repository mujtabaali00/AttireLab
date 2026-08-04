'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart.store'

// Serialized product type (Decimal → number, Date → string)
export interface SerializedProduct {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  categoryId: string
  colors: string[]
  sizes: string[]
  createdAt: string
  updatedAt: string
  images: { id: string; url: string; productId: string }[]
}

export function ProductCard({ product }: { product: SerializedProduct }) {
  const [qty, setQty] = useState(1)
  const addItem = useCartStore(state => state.addItem)
  const isOutOfStock = product.quantity === 0

  const handleAdd = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.images[0]?.url ?? '',
      quantity: qty,
      maxStock: product.quantity,
      color: product.colors[0],
      size: product.sizes[0],
    })
    setQty(1)
  }

  return (
    <div className="bg-white rounded border border-gray-100 overflow-hidden flex flex-col">
      {/* Product Image */}
      <div className="aspect-square relative bg-gray-50">
        {product.images[0]?.url ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No Image
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-gray-500 bg-white border rounded px-2 py-0.5">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-grow">
        <h3 className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-2 mb-1.5 flex-grow leading-tight">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-2.5">
          Price:{' '}
          <span className="text-blue-500 font-semibold text-sm">
            ${product.price.toFixed(2)}
          </span>
        </p>

        {/* Quantity Stepper + Add to Cart */}
        <div className="flex items-center gap-1.5 mt-auto">
          <div className="flex items-center border border-gray-200 rounded bg-white shrink-0">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={isOutOfStock}
              className="p-1 text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-6 text-center text-xs font-medium text-gray-900">
              {qty.toString().padStart(2, '0')}
            </span>
            <button
              onClick={() => setQty(q => Math.min(product.quantity, q + 1))}
              disabled={isOutOfStock}
              className="p-1 text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={isOutOfStock}
            className="flex-1 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-medium py-1.5 px-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
