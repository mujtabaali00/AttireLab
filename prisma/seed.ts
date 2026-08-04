import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with categories and products...')

  // 1. Create Categories
  const categoryTShirts = await prisma.category.upsert({
    where: { slug: 't-shirts' },
    update: {},
    create: {
      name: 'T-Shirts',
      slug: 't-shirts',
    },
  })

  const categoryHoodies = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: {
      name: 'Hoodies',
      slug: 'hoodies',
    },
  })

  const categoryPants = await prisma.category.upsert({
    where: { slug: 'pants' },
    update: {},
    create: {
      name: 'Pants',
      slug: 'pants',
    },
  })

  // 2. Create Products
  const productsToCreate = [
    {
      name: 'Classic White T-Shirt',
      description: 'A premium quality classic white t-shirt made from 100% organic cotton. Perfect for everyday wear.',
      price: 29.99,
      quantity: 100,
      categoryId: categoryTShirts.id,
      colors: ['White', 'Off-White'],
      sizes: ['S', 'M', 'L', 'XL'],
      images: [
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: 'Essential Black Tee',
      description: 'The essential black tee for any wardrobe. Soft, durable, and stylish.',
      price: 29.99,
      quantity: 150,
      categoryId: categoryTShirts.id,
      colors: ['Black'],
      sizes: ['M', 'L', 'XL'],
      images: [
        'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=800&auto=format&fit=crop',
      ]
    },
    {
      name: 'Cozy Grey Hoodie',
      description: 'Stay warm and comfortable with our cozy grey hoodie. Features a front pocket and adjustable drawstring.',
      price: 59.99,
      quantity: 50,
      categoryId: categoryHoodies.id,
      colors: ['Grey', 'Dark Grey'],
      sizes: ['M', 'L'],
      images: [
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop',
      ]
    },
    {
      name: 'Slim Fit Denim Pants',
      description: 'Classic slim fit denim pants with a slight stretch for maximum comfort and mobility.',
      price: 79.99,
      quantity: 75,
      categoryId: categoryPants.id,
      colors: ['Blue', 'Light Blue'],
      sizes: ['30', '32', '34', '36'],
      images: [
        'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=800&auto=format&fit=crop'
      ]
    },
    {
      name: 'Vintage Wash Jeans',
      description: 'Vintage wash jeans with distressed details. A perfect addition to your casual outfits.',
      price: 89.99,
      quantity: 40,
      categoryId: categoryPants.id,
      colors: ['Washed Blue'],
      sizes: ['32', '34'],
      images: [
        'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop',
      ]
    }
  ]

  // Clear existing products so we don't duplicate on re-runs (optional, but good for testing)
  await prisma.productImage.deleteMany()
  await prisma.product.deleteMany()

  for (const p of productsToCreate) {
    const createdProduct = await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        quantity: p.quantity,
        categoryId: p.categoryId,
        colors: p.colors,
        sizes: p.sizes,
        images: {
          create: p.images.map(url => ({ url }))
        }
      }
    })
    console.log(`Created product: ${createdProduct.name}`)
  }

  console.log('Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
