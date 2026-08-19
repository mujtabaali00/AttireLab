import { db } from '@/lib/db'
import Link from 'next/link'
import { ProductsClientTable } from '@/components/admin/ProductsAdminTable'

export const metadata = { title: 'Products' }
export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const [dbProducts, categories] = await Promise.all([
    db.product.findMany({
      include: { images: true, category: true, specifications: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const products = dbProducts.map(product => ({
    ...product,
    price: Number(product.price),
    specifications: product.specifications?.map(spec => ({
      ...spec,
      price: spec.price ? Number(spec.price) : null
    }))
  }))

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-blue-600">Products</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center justify-center border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Add a Single Product
          </Link>
          <button
            disabled
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            title="Coming soon"
          >
            + Add Multiple Products
          </button>
        </div>
      </div>

      <ProductsClientTable products={products} categories={categories} />
    </div>
  )
}
