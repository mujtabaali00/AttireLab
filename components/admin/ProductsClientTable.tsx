'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Package, Edit, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

// We need a simplified product type for the table
type ProductWithDetails = {
  id: string
  name: string
  description: string | null
  price: number | import('@prisma/client').Prisma.Decimal
  quantity: number
  category: { name: string }
  images: { url: string }[]
}

export function ProductsClientTable({ products }: { products: ProductWithDetails[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Pagination state (simple client-side pagination)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage))
  const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const confirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/products/${deletingId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Failed to delete product')
      }
    } catch {
      alert('An error occurred while deleting')
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 flex flex-col items-center justify-center gap-3">
        <Package className="w-12 h-12 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No products yet</p>
        <Link
          href="/admin/products/new"
          className="text-sm text-blue-500 hover:underline font-medium"
        >
          Add your first product
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-[60vh]">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
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
                      <div>
                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-gray-400 line-clamp-1 max-w-[200px]">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold text-gray-900">
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-gray-700">{product.quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors"
                        title="Edit Product"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => setDeletingId(product.id)}
                        className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                        title="Remove Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 mt-auto bg-white">
          <span className="text-sm text-transparent select-none">Spacer</span>
          
          <div className="flex items-center border border-gray-200 rounded divide-x divide-gray-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }).map((_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    currentPage === page 
                      ? 'bg-blue-50 text-blue-600 font-medium' 
                      : 'text-blue-500 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm text-blue-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-xs text-center shadow-xl">
            <h3 className="text-lg font-semibold text-blue-500 mb-1">Remove Product</h3>
            <div className="flex justify-center my-4">
              <svg className="w-14 h-14 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-5">
              Are You Sure You Want To Delete The Item!
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
