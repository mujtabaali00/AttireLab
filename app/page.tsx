import { db } from '@/lib/db'
import { ProductList } from '@/components/products/ProductList'

export default async function Home() {
  const rawProducts = await db.product.findMany({
    include: { images: true },
    orderBy: { createdAt: 'desc' }
  })

  // Serialize Prisma Decimal and Date objects before passing to Client Component
  const products = rawProducts.map(p => ({
    ...p,
    price: Number(p.price),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-100">
        <ProductList initialProducts={products} />
      </div>
    </div>
  )
}
