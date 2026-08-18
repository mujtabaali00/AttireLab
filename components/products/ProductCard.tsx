'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/lib/store/cart.store'
import { toast } from 'react-hot-toast'

export interface ProductSpecification {
  id: string
  color: string | null
  size: string | null
  quantity: number
  price: number | null
  imageUrl: string | null
}

export interface SerializedProduct {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  categoryId: string | null
  categoryName?: string | null
  createdAt: string
  updatedAt: string
  images: { id: string; url: string; productId: string }[]
  specifications?: ProductSpecification[]
}

// Colour name → CSS colour value mapping
const COLOR_CSS: Record<string, string> = {
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  brown: '#92400E',
  grey: '#9CA3AF',
  black: '#111827',
  white: '#F9FAFB',
  navy: '#1E3A5F',
  maroon: '#7F1D1D',
  pink: '#EC4899',
  purple: '#A855F7',
  orange: '#F97316',
  beige: '#D4B896',
}

export function ProductCard({ product }: { product: SerializedProduct }) {
  const [qty, setQty] = useState(1)
  const addItem = useCartStore(state => state.addItem)

  // Local, optimistically-updated copies of stock so the card reflects an
  // add-to-cart immediately without needing a full page reload.
  const [specs, setSpecs] = useState(product.specifications)
  const [productQty, setProductQty] = useState(product.quantity)

  const hasSpecs = specs && specs.length > 0

  const allColors = useMemo(() => {
    if (!hasSpecs) return []
    const colors = new Set(specs!.map(s => s.color).filter(Boolean) as string[])
    return Array.from(colors)
  }, [specs, hasSpecs])

  const allSizes = useMemo(() => {
    if (!hasSpecs) return []
    const sizes = new Set(specs!.map(s => s.size).filter(Boolean) as string[])
    return Array.from(sizes)
  }, [specs, hasSpecs])

  const [selectedColor, setSelectedColor] = useState<string | null>(() => {
    if (!product.specifications || product.specifications.length === 0) return null
    // Pick the first color that has stock
    const colors = Array.from(new Set(product.specifications.map(s => s.color).filter(Boolean) as string[]))
    const firstInStock = colors.find(c =>
      product.specifications!.some(s => s.color === c && s.quantity > 0)
    )
    return firstInStock || colors[0] || null
  })
  const [selectedSize, setSelectedSize] = useState<string | null>(() => {
    if (!product.specifications || product.specifications.length === 0) return null
    const sizes = Array.from(new Set(product.specifications.map(s => s.size).filter(Boolean) as string[]))
    const firstInStock = sizes.find(sz =>
      product.specifications!.some(s => s.size === sz && s.quantity > 0)
    )
    return firstInStock || sizes[0] || null
  })

  const matchingSpec = useMemo(() => {
    if (!hasSpecs) return null
    return specs!.find(
      s => (s.color === selectedColor || (!s.color && !selectedColor)) &&
        (s.size === selectedSize || (!s.size && !selectedSize))
    ) || null
  }, [specs, hasSpecs, selectedColor, selectedSize])

  const currentPrice = matchingSpec?.price ? matchingSpec.price : product.price

  const totalStock = hasSpecs
    ? specs!.reduce((sum, spec) => sum + spec.quantity, 0)
    : productQty

  const isTotalOutOfStock = totalStock === 0
  const maxAllowedQty = hasSpecs ? (matchingSpec?.quantity || 0) : productQty
  const isSelectionOutOfStock = hasSpecs && maxAllowedQty === 0

  const displayImage = matchingSpec?.imageUrl || product.images[0]?.url
  const displayedQty = Math.max(1, Math.min(qty, maxAllowedQty || 999))

  const handleAdd = async () => {
    if (isSelectionOutOfStock || (hasSpecs && !matchingSpec)) return
    try {
      await addItem({
        productId: product.id,
        specificationId: matchingSpec?.id,
        name: product.name,
        price: currentPrice,
        imageUrl: displayImage ?? '',
        quantity: displayedQty,
        color: selectedColor || undefined,
        size: selectedSize || undefined,
      })
      // Reflect the stock deduction immediately — the server already deducted
      // it, this just keeps the card in sync without a page reload.
      if (hasSpecs && matchingSpec) {
        const specId = matchingSpec.id
        setSpecs(prev => prev!.map(s => s.id === specId ? { ...s, quantity: s.quantity - displayedQty } : s))
      } else {
        setProductQty(prev => prev - displayedQty)
      }
      setQty(1)
      toast.success('Added to cart!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add item'
      toast.error(message.includes('Only 0 items left in stock') ? 'This item is out of stock.' : message)
    }
  }

  const isOptionInStock = (type: 'color' | 'size', value: string) => {
    if (!hasSpecs) return true
    if (type === 'color') {
      const matches = specs!.filter(s => s.color === value && (selectedSize ? s.size === selectedSize : true))
      if (matches.length === 0) return specs!.some(s => s.color === value && s.quantity > 0)
      return matches.some(s => s.quantity > 0)
    } else {
      const matches = specs!.filter(s => s.size === value && (selectedColor ? s.color === selectedColor : true))
      if (matches.length === 0) return specs!.some(s => s.size === value && s.quantity > 0)
      return matches.some(s => s.quantity > 0)
    }
  }

  const stockCount = hasSpecs ? (matchingSpec?.quantity ?? 0) : productQty

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden flex flex-col border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Product Image — tall square */}
      <div className="relative bg-gray-100" style={{ aspectRatio: '1 / 1' }}>
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No Image
          </div>
        )}
        {isTotalOutOfStock && (
          <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
            <span className="text-sm font-semibold text-red-500">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-grow">
        {/* Name */}
        <h3 className="text-sm font-medium text-gray-800 line-clamp-1">
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-sm text-gray-600">Price:</span>
          <span className="text-sm font-bold text-blue-600">
            Rs {currentPrice.toLocaleString()}
          </span>
        </div>

        {/* Color swatches */}
        {allColors.length > 0 && !isTotalOutOfStock && (
          <div className="flex flex-wrap gap-1.5">
            {allColors.map(color => {
              const inStock = isOptionInStock('color', color)
              const cssColor = COLOR_CSS[color] || color
              const isLight = ['white', 'beige', 'yellow'].includes(color)
              return (
                <button
                  key={color}
                  onClick={() => inStock && setSelectedColor(color)}
                  disabled={!inStock}
                  title={`${color.charAt(0).toUpperCase() + color.slice(1)}${!inStock ? ' (Out of stock)' : ''}`}
                  className={`relative w-5 h-5 rounded-full flex-shrink-0 transition-all overflow-hidden ${
                    selectedColor === color
                      ? isLight
                        ? 'ring-2 ring-offset-1 ring-gray-500'
                        : 'ring-2 ring-offset-1 ring-blue-500'
                      : 'ring-1 ring-gray-300'
                  } ${!inStock ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-2 hover:ring-blue-400'}`}
                  style={{ backgroundColor: cssColor }}
                >
                  {!inStock && (
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(to top right, transparent calc(50% - 0.5px), #EF4444 calc(50% - 0.5px), #EF4444 calc(50% + 0.5px), transparent calc(50% + 0.5px))'
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Size buttons */}
        {allSizes.length > 0 && !isTotalOutOfStock && (
          <div className="flex flex-wrap gap-1">
            {allSizes.map(size => {
              const inStock = isOptionInStock('size', size)
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  disabled={!inStock}
                  className={`min-w-[30px] px-2 py-0.5 text-xs font-semibold rounded-sm uppercase border transition-colors ${
                    selectedSize === size
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                  } ${!inStock ? 'opacity-30 cursor-not-allowed line-through' : ''}`}
                >
                  {size}
                </button>
              )
            })}
          </div>
        )}

        {/* Stock count */}
        <p className="text-xs text-gray-500">
          {isTotalOutOfStock ? 'Out of stock' : `${stockCount} in stock`}
        </p>

        {/* Qty stepper + Add to Cart */}
        <div className="flex items-center gap-2 mt-auto">
          {/* Qty stepper */}
          <div className="flex items-center border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={isTotalOutOfStock || isSelectionOutOfStock}
              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-base font-medium transition-colors"
            >
              −
            </button>
            <span className="w-8 text-center text-xs font-semibold text-gray-900 border-x border-gray-300 h-7 flex items-center justify-center">
              {String(displayedQty).padStart(2, '0')}
            </span>
            <button
              onClick={() => setQty(q => Math.min(maxAllowedQty || 999, q + 1))}
              disabled={isTotalOutOfStock || isSelectionOutOfStock || displayedQty >= maxAllowedQty}
              className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-base font-medium transition-colors"
            >
              +
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAdd}
            disabled={isTotalOutOfStock || isSelectionOutOfStock || (hasSpecs && !matchingSpec)}
            className="flex-1 h-7 text-white text-xs font-semibold rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}