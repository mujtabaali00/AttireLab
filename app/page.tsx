import { db } from '@/lib/db'
import { ProductList } from '@/components/products/ProductList'
import { serializeProduct } from '@/lib/product-serializer'

export const revalidate = 60

export default async function Home() {
  const [rawProducts, categories] = await Promise.all([
    db.product.findMany({
      include: { images: true, specifications: true, category: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const products = rawProducts.map(serializeProduct)

  return (
    <div className="py-2">
      <ProductList initialProducts={products} categories={categories} />
    </div>
  )
}
