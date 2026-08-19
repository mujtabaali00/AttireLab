'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, Pencil, Power, Search, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Category } from '@prisma/client'

type ProductWithDetails = {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  status: string
  categoryId: string | null
  category: { name: string } | null
  images: { url: string }[]
  specifications?: { id: string }[]
}

export function ProductsClientTable({
  products,
  categories,
}: {
  products: ProductWithDetails[]
  categories: Category[]
}) {
  const router = useRouter()
  const [togglingProduct, setTogglingProduct] = useState<{ id: string; name: string; nextStatus: 'ACTIVE' | 'INACTIVE' } | null>(null)
  const [isToggling, setIsToggling] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredProducts = useMemo(
    () =>
      products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory
        const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus
        return matchesSearch && matchesCategory && matchesStatus
      }),
    [products, searchQuery, selectedCategory, selectedStatus]
  )

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage))
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const confirmToggleStatus = async () => {
    if (!togglingProduct) return
    setIsToggling(true)
    try {
      const res = await fetch(`/api/products/${togglingProduct.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: togglingProduct.nextStatus }),
      })
      if (res.ok) {
        toast.success(togglingProduct.nextStatus === 'ACTIVE' ? 'Product activated' : 'Product deactivated')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to update product status')
      }
    } catch {
      toast.error('An error occurred while updating the product')
    } finally {
      setIsToggling(false)
      setTogglingProduct(null)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Search bar and filters */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder-gray-400"
            />
          </div>
          <div className="flex w-full sm:w-auto items-center gap-3">
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value)
                setCurrentPage(1)
              }}
              className="flex-1 sm:w-auto py-1.5 pl-3 pr-8 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={e => {
                setSelectedStatus(e.target.value)
                setCurrentPage(1)
              }}
              className="flex-1 sm:w-auto py-1.5 pl-3 pr-8 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-gray-700 bg-white"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
              <Package className="w-10 h-10 text-gray-200" />
              <p className="text-sm text-gray-400">No products found</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Price</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Stock</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedProducts.map(product => {
                  const variantCount = product.specifications?.length ?? 0
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      {/* Title with thumbnail */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                            {product.images[0]?.url ? (
                              <Image
                                src={product.images[0].url}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="40px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-900 line-clamp-1">{product.name}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {product.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 text-gray-700">
                        Rs {Number(product.price).toLocaleString()}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-gray-600">
                        {product.category?.name || '—'}
                      </td>

                      {/* Stock + variant count */}
                      <td className="px-4 py-3">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-gray-900">{product.quantity}</span>
                          {variantCount > 0 && (
                            <span className="text-xs text-gray-400">({variantCount} Variant{variantCount !== 1 ? 's' : ''})</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Edit — pencil icon */}
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                            title="Edit Product"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          {/* Activate/Deactivate — soft delete toggle, product is never hard-deleted */}
                          {product.status === 'ACTIVE' ? (
                            <button
                              onClick={() => setTogglingProduct({ id: product.id, name: product.name, nextStatus: 'INACTIVE' })}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Deactivate Product"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setTogglingProduct({ id: product.id, name: product.name, nextStatus: 'ACTIVE' })}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Activate Product"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end px-4 py-3 border-t border-gray-100 gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm text-blue-500 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-7 text-sm rounded border transition-colors ${currentPage === i + 1
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm text-blue-500 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Activate/Deactivate confirmation modal */}
      {togglingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs text-center shadow-xl">
            <h3 className="text-lg font-semibold text-blue-500 mb-1">
              {togglingProduct.nextStatus === 'ACTIVE' ? 'Activate Product' : 'Deactivate Product'}
            </h3>
            <div className="flex justify-center my-4">
              <svg className="w-14 h-14 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-5">
              {togglingProduct.nextStatus === 'ACTIVE'
                ? <>Make <strong>{togglingProduct.name}</strong> visible to customers again?</>
                : <><strong>{togglingProduct.name}</strong> will be hidden from customers. You can activate it again anytime.</>}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setTogglingProduct(null)}
                disabled={isToggling}
                className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={confirmToggleStatus}
                disabled={isToggling}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center min-w-[52px]"
              >
                {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}