import { db } from '@/lib/db'
import { ProductList } from '@/components/products/ProductList'
import { serializeProduct } from '@/lib/product-serializer'
import { ProductStatus } from '@prisma/client'

import { releaseExpiredCarts } from '@/lib/cart'

export const revalidate = 0 // dynamic for stock

const PAGE_SIZE = 20

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await releaseExpiredCarts()

  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const [rawProducts, totalCount, categories] = await Promise.all([
    db.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: { images: true, specifications: true, category: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where: { status: ProductStatus.ACTIVE } }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const products = rawProducts.map(serializeProduct)
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="min-h-[calc(100vh-72px)] bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <ProductList
          initialProducts={products}
          categories={categories}
          currentPage={page}
          totalPages={totalPages}
        />
      </div>
    </div>
  )
}
