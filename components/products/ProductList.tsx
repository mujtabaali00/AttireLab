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
    <div>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900 hidden sm:block">Our Products</h2>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          {/* Category Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="appearance-none border border-gray-200 rounded-lg pl-4 pr-10 h-11 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Search */}
          <div className="flex h-11 w-full sm:w-auto flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-4 pr-4 border border-r-0 border-gray-200 rounded-l-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full sm:w-56"
            />
            <div className="w-11 shrink-0 bg-blue-500 rounded-r-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-blue-600 shadow-sm">
              <Search className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="appearance-none border border-gray-200 rounded-lg pl-4 pr-10 h-11 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer w-full sm:w-auto"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Products Grid — 4 columns on large screens */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
