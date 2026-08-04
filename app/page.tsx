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
    <div className="bg-white p-4 sm:p-6 lg:p-8">
      <ProductList initialProducts={products} />
    </div>
  )
}
