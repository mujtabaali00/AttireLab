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
  }, [initialProducts, search, selectedCategory, sortBy])

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

      {/* Products Grid — 4 columns matching screenshot */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}