import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const categories = ['T-Shirts', 'Trousers', 'Jackets', 'Shoes', 'Accessories']
  
  for (const name of categories) {
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug
      }
    })
  }

  const adminEmail = 'admin@attirelab.com'
  const passwordHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN'
    }
  })

  console.log('Database seeded successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
