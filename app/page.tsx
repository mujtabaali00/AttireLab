import { db } from '@/lib/db'
import { ProductList } from '@/components/products/ProductList'
import { serializeProduct } from '@/lib/product-serializer'
import { ProductStatus } from '@prisma/client'

export const revalidate = 60

export default async function Home() {
  const [rawProducts, categories] = await Promise.all([
    db.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: { images: true, specifications: true, category: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const products = rawProducts.map(serializeProduct)

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <ProductList initialProducts={products} categories={categories} />
      </div>
    </div>
  )
}
