'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { ProductCard, type SerializedProduct } from './ProductCard'

interface Category {
  id: string
  name: string
  slug: string
}

interface ProductListProps {
  initialProducts: SerializedProduct[]
  categories: Category[]
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
]

export function ProductList({ initialProducts, categories }: ProductListProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  const filtered = useMemo(() => {
    let list = [...initialProducts]

    // Filter by category
    if (selectedCategory !== 'all') {
      list = list.filter(p => p.categoryId === selectedCategory)
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }

    // Sort
    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price)
    else if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price)

    return list
  }, [initialProducts, search, selectedCategory, sortBy])

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {/* Header Row */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-blue-600">Our Products</h2>
          <p className="mt-2 text-sm text-gray-500">Search products, filter inventory, and find the latest items.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end w-full sm:w-auto">
          <div className="relative w-full sm:w-[360px]">
            <input
              type="text"
              placeholder="Search products or categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-slate-50 py-3 pl-4 pr-12 text-sm text-gray-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200"
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition">
              <Search className="w-4 h-4" />
            </button>
          </div>

          <div className="relative w-full sm:w-44">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Products Grid — 4 columns on large screens */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,280px))] justify-center gap-6">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}