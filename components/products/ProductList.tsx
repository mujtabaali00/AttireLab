'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { ProductCard, type SerializedProduct } from './ProductCard'

export function ProductList({ initialProducts }: { initialProducts: SerializedProduct[] }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  let products = [...initialProducts]

  // Client-side search by product name
  if (search.trim()) {
    const q = search.toLowerCase()
    products = products.filter(p => p.name.toLowerCase().includes(q))
  }

  // Client-side sort
  if (sortBy === 'price_asc') {
    products.sort((a, b) => a.price - b.price)
  } else if (sortBy === 'price_desc') {
    products.sort((a, b) => b.price - a.price)
  }

  return (
    <div>
      {/* Header Row — matches mobile design */}
      <h2 className="text-xl font-bold text-blue-500 mb-4">Our Products</h2>

      <div className="flex gap-2 mb-5">
        {/* Search bar */}
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by user & order ID"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 border border-gray-200 rounded text-xs text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-gray-500 hidden sm:inline">Sort by:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded py-2 pl-2 pr-6 text-xs bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="newest">Sort by:</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </div>
      </div>

      {/* 2-column grid on mobile, 3 on tablet, 4 on desktop — matching the mockup */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No products found.</p>
        </div>
      )}
    </div>
  )
}
