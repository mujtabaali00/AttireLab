import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { OrderDetailView, ORDER_DETAIL_INCLUDE } from '@/components/orders/OrderDetailView'

export const metadata = { title: 'Order Detail — Admin' }

// Admin access is already enforced by proxy.ts + app/admin/layout.tsx.
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: ORDER_DETAIL_INCLUDE,
  })

  if (!order) notFound()

  return <OrderDetailView order={order} variant="admin" />
}
