import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { EditProductForm } from '@/components/admin/EditProductForm'

export const metadata = { title: 'Edit Product' }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    include: { images: true, specifications: true },
  })

  if (!product) notFound()

  const initialData = {
    name: product.name,
    description: product.description || undefined,
    price: Number(product.price),
    quantity: product.quantity,
    categoryId: product.categoryId ?? '',
    imageUrls: product.images.map(img => img.url),
    specifications: product.specifications.map(spec => ({
      color: spec.color,
      size: spec.size,
      quantity: spec.quantity,
      price: spec.price ? Number(spec.price) : undefined,
      imageUrl: spec.imageUrl || undefined,
    })),
  }

  return <EditProductForm productId={id} initialData={initialData} />
}
