'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, Loader2 } from 'lucide-react'
import { ProductCard, type SerializedProduct } from './ProductCard'
import { APP_CONSTANTS } from '@/lib/constants'

interface Category {
  id: string
  name: string
  slug: string
}

interface ProductListProps {
  initialProducts: SerializedProduct[]
  categories: Category[]
  initialHasMore: boolean
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
]

const BATCH_SIZE = APP_CONSTANTS.PRODUCTS.LAZY_BATCH_SIZE

export function ProductList({ initialProducts, categories, initialHasMore }: ProductListProps) {
  const [products, setProducts] = useState(initialProducts)
  const [page, setPage] = useState(1) // page 1 was already loaded server-side
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetch(`/api/products?page=${nextPage}&limit=${BATCH_SIZE}`)
      const data = await res.json()
      if (data.data) {
        const newProducts = data.data.products as SerializedProduct[]
        setProducts(prev => [...prev, ...newProducts])
        setPage(nextPage)
        setHasMore(nextPage * BATCH_SIZE < data.data.total)
      } else {
        setHasMore(false)
      }
    } catch {
      // Leave hasMore as-is — scrolling again will retry.
    } finally {
      loadingRef.current = false
      setIsLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, page])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore()
      },
      { rootMargin: '600px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const filtered = useMemo(() => {
    let list = [...products]

    if (selectedCategory !== 'all') {
      list = list.filter(p => p.categoryId === selectedCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }

    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price)
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price)

    return list
  }, [products, search, selectedCategory, sortBy])

  return (
    <div className="px-4 py-6 sm:px-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-blue-600">Our Products</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Search products or categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-72 rounded border border-gray-300 bg-white py-1.5 pl-3 pr-9 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 placeholder-gray-400"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full sm:w-auto appearance-none rounded border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Products Grid — 4 columns on desktop so each batch of 8 fills two rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={sentinelRef} className="h-px" />

      {isLoadingMore && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading more products...
        </div>
      )}

      {!hasMore && products.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-6">You&apos;ve reached the end of the catalogue.</p>
      )}
    </div>
  )
}
