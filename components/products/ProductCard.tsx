'use client'

import { useState, useMemo } from 'react'
import { Plus, Minus } from 'lucide-react'
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
  categoryId: string
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

  const hasSpecs = product.specifications && product.specifications.length > 0

  const allColors = useMemo(() => {
    if (!hasSpecs) return []
    const colors = new Set(product.specifications!.map(s => s.color).filter(Boolean) as string[])
    return Array.from(colors)
  }, [product.specifications, hasSpecs])

  const allSizes = useMemo(() => {
    if (!hasSpecs) return []
    const sizes = new Set(product.specifications!.map(s => s.size).filter(Boolean) as string[])
    return Array.from(sizes)
  }, [product.specifications, hasSpecs])

  const [selectedColor, setSelectedColor] = useState<string | null>(allColors[0] || null)
  const [selectedSize, setSelectedSize] = useState<string | null>(allSizes[0] || null)

  const matchingSpec = useMemo(() => {
    if (!hasSpecs) return null
    return product.specifications!.find(
      s => (s.color === selectedColor || (!s.color && !selectedColor)) &&
        (s.size === selectedSize || (!s.size && !selectedSize))
    ) || null
  }, [product.specifications, hasSpecs, selectedColor, selectedSize])

  const currentPrice = matchingSpec?.price ? matchingSpec.price : product.price

  const totalStock = hasSpecs
    ? product.specifications!.reduce((sum, spec) => sum + spec.quantity, 0)
    : product.quantity

  const isTotalOutOfStock = totalStock === 0
  const maxAllowedQty = hasSpecs ? (matchingSpec?.quantity || 0) : product.quantity
  const isSelectionOutOfStock = hasSpecs && maxAllowedQty === 0

  // Switch image when colour changes — use spec image if available
  const displayImage = matchingSpec?.imageUrl || product.images[0]?.url

  const displayedQty = Math.max(1, Math.min(qty, maxAllowedQty || 999))

  const handleAdd = async () => {
    if (isSelectionOutOfStock || (hasSpecs && !matchingSpec)) return
    try {
      await addItem({
        productId: product.id,
        name: product.name,
        price: currentPrice,
        imageUrl: displayImage ?? '',
        quantity: displayedQty,
        maxStock: maxAllowedQty,
        color: selectedColor || undefined,
        size: selectedSize || undefined,
      })
      setQty(1)
      toast.success('Added to Cart')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add item'
      toast.error(message.includes('Only 0 items left in stock') ? 'This item is out of stock.' : message)
    }
  }

  const isOptionInStock = (type: 'color' | 'size', value: string) => {
    if (!hasSpecs) return true
    if (type === 'color') {
      const specs = product.specifications!.filter(s => s.color === value && (selectedSize ? s.size === selectedSize : true))
      if (specs.length === 0) return product.specifications!.some(s => s.color === value && s.quantity > 0)
      return specs.some(s => s.quantity > 0)
    } else {
      const specs = product.specifications!.filter(s => s.size === value && (selectedColor ? s.color === selectedColor : true))
      if (specs.length === 0) return product.specifications!.some(s => s.size === value && s.quantity > 0)
      return specs.some(s => s.quantity > 0)
    }
  }

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden flex flex-col border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Product Image */}
      <div className="relative bg-gray-50" style={{ aspectRatio: '6/5' }}>
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No Image
          </div>
        )}
        {isTotalOutOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-sm font-semibold text-red-500">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-1.5 flex flex-col gap-[3px] flex-grow">
        {/* Name */}
        <h3 className="text-[11px] font-medium text-gray-800 line-clamp-1">
          {product.name}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-gray-500">Price:</span>
          <span className="text-[12px] font-bold text-blue-500">
            Rs {currentPrice.toLocaleString()}
          </span>
        </div>

        {/* Variants */}
        {hasSpecs && !isTotalOutOfStock && (
          <div className="space-y-0.5">
            {/* Color swatches */}
            {allColors.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {allColors.map(color => {
                  const inStock = isOptionInStock('color', color)
                  const cssColor = COLOR_CSS[color] || color
                  const isLight = ['white', 'beige', 'yellow'].includes(color)
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      disabled={!inStock}
                      title={color.charAt(0).toUpperCase() + color.slice(1)}
                      className={`w-[15px] h-[15px] rounded-full border-2 transition-all flex-shrink-0 ${selectedColor === color
                          ? isLight ? 'border-gray-500 scale-110' : 'border-blue-500 scale-110'
                          : 'border-transparent hover:border-gray-300'
                        } ${!inStock ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ backgroundColor: cssColor }}
                    />
                  )
                })}
              </div>
            )}

            {/* Size buttons */}
            {allSizes.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {allSizes.map(size => {
                  const inStock = isOptionInStock('size', size)
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={!inStock}
                      className={`min-w-[22px] px-1 py-0.5 text-[8px] font-semibold rounded border uppercase transition-colors ${selectedSize === size
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
          </div>
        )}

        {/* Stock count */}
        <p className="text-[9px] text-gray-400">
          {isTotalOutOfStock ? 'Out of stock' : `${hasSpecs ? (matchingSpec?.quantity ?? 0) : totalStock} in stock`}
        </p>

        {/* Qty + Add to Cart */}
        <div className="flex items-center gap-1 mt-auto pt-0.5">
          {/* Qty stepper */}
          <div className="flex items-center border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              disabled={isTotalOutOfStock || isSelectionOutOfStock}
              className="px-1.5 py-[2px] text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-7 text-center text-[10px] font-semibold text-gray-900 border-x border-gray-300 py-[2px]">
              {String(displayedQty).padStart(2, '0')}
            </span>
            <button
              onClick={() => setQty(q => Math.min(maxAllowedQty || 999, q + 1))}
              disabled={isTotalOutOfStock || isSelectionOutOfStock || displayedQty >= maxAllowedQty}
              className="px-1.5 py-[2px] text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAdd}
            disabled={isTotalOutOfStock || isSelectionOutOfStock || (hasSpecs && !matchingSpec)}
            className="flex-1 py-[2px] text-white text-[10px] font-semibold rounded transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 hover:bg-blue-600"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}