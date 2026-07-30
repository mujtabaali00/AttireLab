import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').multipleOf(0.01, 'Max 2 decimal places'),
  quantity: z.number().int().nonnegative('Quantity must be zero or more'),
  categoryId: z.string().cuid('Invalid category ID'),
  imageUrls: z.array(z.string()).min(1, 'At least 1 image is required').max(5, 'At most 5 images are allowed')
})

export const updateProductSchema = createProductSchema.partial()

export const bulkProductRowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.coerce.number().positive(),
  quantity: z.coerce.number().int().nonnegative(),
  categoryName: z.string().min(2),
  imageUrl: z.string().optional()
})
