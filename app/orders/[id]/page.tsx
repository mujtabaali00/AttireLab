import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { OrderDetailView, ORDER_DETAIL_INCLUDE } from '@/components/orders/OrderDetailView'

export const metadata = { title: 'Order Detail' }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const order = await db.order.findUnique({
    where: { id },
    include: ORDER_DETAIL_INCLUDE,
  })

  if (!order) notFound()
  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') redirect('/orders')

  return <OrderDetailView order={order} variant="customer" />
}
