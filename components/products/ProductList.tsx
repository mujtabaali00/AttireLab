'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { ProductCard, type SerializedProduct } from './ProductCard'

export function ProductList({ initialProducts }: { initialProducts: SerializedProduct[] }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')

  let products = [...initialProducts]

  // Client-side search by name (not by ID per user's requirement)
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
  // 'newest' keeps the server-returned order (desc by createdAt)

  return (
    <div>
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold text-blue-500">Our Products</h2>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-64 pl-4 pr-10 py-2 border border-gray-200 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-md py-2 pl-3 pr-8 text-sm bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="newest">Sort by: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No products found.</p>
        </div>
      )}
    </div>
  )
}
