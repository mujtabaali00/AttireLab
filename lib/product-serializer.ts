import type { Product, ProductImage, ProductSpecification, Category } from '@prisma/client'

type ProductWithRelations = Product & {
  images: ProductImage[]
  specifications?: ProductSpecification[]
  category?: Category
}

export function serializeProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    quantity: product.quantity,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    images: product.images,
    specifications: product.specifications?.map(spec => ({
      id: spec.id,
      color: spec.color,
      size: spec.size,
      quantity: spec.quantity,
      price: spec.price ? Number(spec.price) : null,
      imageUrl: spec.imageUrl,
    })),
  }
}

export function computeTotalStock(
  quantity: number,
  specifications?: { quantity: number }[]
) {
  if (specifications && specifications.length > 0) {
    return specifications.reduce((sum, spec) => sum + spec.quantity, 0)
  }
  return quantity
}
