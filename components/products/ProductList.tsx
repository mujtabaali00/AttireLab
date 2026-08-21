'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
// How many extra batches stay mounted behind the loading edge before the
// far one gets dropped from the DOM. Dropped batches stay in pageCache, so
// scrolling back up re-renders them instantly with no re-fetch.
const WINDOW_BATCHES = 2

// Variant prices can be higher or lower than the base price — sort by the
// cheapest price a shopper could actually pay for the product, not the base.
function getEffectivePrice(product: SerializedProduct): number {
  if (product.specifications && product.specifications.length > 0) {
    const variantPrices = product.specifications
      .map(s => s.price)
      .filter((p): p is number => p != null)
    if (variantPrices.length > 0) return Math.min(...variantPrices)
  }
  return product.price
}

export function ProductList({ initialProducts, categories, initialHasMore }: ProductListProps) {
  // Every fetched page stays here so scrolling back up never needs a re-fetch.
  const [pageCache, setPageCache] = useState<Map<number, SerializedProduct[]>>(() => new Map([[1, initialProducts]]))
  const [minPage, setMinPage] = useState(1)
  const [maxPage, setMaxPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Whenever a batch is dropped from (or restored to) the top of the grid,
  // the content above the viewport changes height and the browser would
  // otherwise visibly jump. We capture a "before" position of an element
  // that survives the update, then correct scrollY by however much that
  // same element actually moved — a manual scroll anchor.
  const pendingAnchorRef = useRef<{ el: HTMLElement; top: number } | null>(null)

  const captureScrollAnchor = useCallback((anchorIndex: number) => {
    const grid = gridRef.current
    const el = grid?.children[anchorIndex] as HTMLElement | undefined
    if (!el) return
    pendingAnchorRef.current = { el, top: el.getBoundingClientRect().top }
  }, [])

  useLayoutEffect(() => {
    const pending = pendingAnchorRef.current
    if (!pending) return
    pendingAnchorRef.current = null
    const delta = pending.el.getBoundingClientRect().top - pending.top
    if (delta !== 0) window.scrollBy(0, delta)
  })

  // While actively searching/filtering — or sorted by anything other than
  // fetch order — don't drop batches. Sorting reshuffles which items land
  // near the top of the grid, so "the oldest-fetched page" is no longer the
  // same thing as "the items currently at the top"; dropping it could make
  // arbitrary, still-matching products vanish from the middle of the list.
  const isFiltering = selectedCategory !== 'all' || search.trim() !== '' || sortBy !== 'newest'
  const effectiveMinPage = isFiltering ? 1 : minPage

  const products = useMemo(() => {
    const list: SerializedProduct[] = []
    for (let p = effectiveMinPage; p <= maxPage; p++) {
      list.push(...(pageCache.get(p) ?? []))
    }
    return list
  }, [pageCache, effectiveMinPage, maxPage])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setIsLoadingMore(true)
    try {
      const nextPage = maxPage + 1
      let pageData = pageCache.get(nextPage)
      if (!pageData) {
        const res = await fetch(`/api/products?page=${nextPage}&limit=${BATCH_SIZE}`)
        const data = await res.json()
        if (!data.data) {
          setHasMore(false)
          return
        }
        pageData = data.data.products as SerializedProduct[]
        setPageCache(prev => new Map(prev).set(nextPage, pageData!))
        setHasMore(nextPage * BATCH_SIZE < data.data.total)
      }
      setMaxPage(nextPage)
      setMinPage(prev => {
        const target = Math.max(prev, nextPage - WINDOW_BATCHES)
        if (target > prev && !isFiltering) {
          // The page at `prev` is about to be dropped — anchor on the item
          // right after it (the new first-rendered item) before it happens.
          captureScrollAnchor(pageCache.get(prev)?.length ?? BATCH_SIZE)
        }
        return target
      })
    } catch {
      // Leave hasMore as-is — scrolling again will retry.
    } finally {
      loadingRef.current = false
      setIsLoadingMore(false)
    }
  }, [hasMore, maxPage, pageCache, isFiltering, captureScrollAnchor])

  // Bring back a previously-dropped batch when scrolling back up — always
  // already cached, so this is instant with no network request.
  const loadPrevious = useCallback(() => {
    if (minPage <= 1) return
    // The current first-rendered item is about to be pushed down by the
    // batch we're restoring above it — anchor on it before that happens.
    captureScrollAnchor(0)
    const target = minPage - 1
    setMaxPage(prevMax => Math.min(prevMax, target + WINDOW_BATCHES))
    setMinPage(target)
  }, [minPage, captureScrollAnchor])

  useEffect(() => {
    const sentinel = bottomSentinelRef.current
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

  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel || isFiltering) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadPrevious()
      },
      { rootMargin: '600px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadPrevious, isFiltering])

  const filtered = useMemo(() => {
    let list = [...products]

    if (selectedCategory !== 'all') {
      list = list.filter(p => p.categoryId === selectedCategory)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }

    if (sortBy === 'price_asc') list.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b))
    else if (sortBy === 'price_desc') list.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a))

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

          {/* Category dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto appearance-none rounded border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-gray-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
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

      {/* Top sentinel — scrolling back up past here re-mounts the previous (cached) batch */}
      <div ref={topSentinelRef} className="h-px" />

      {/* Products Grid — 4 columns on desktop so each batch of 8 fills two rows */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={bottomSentinelRef} className="h-px" />

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
