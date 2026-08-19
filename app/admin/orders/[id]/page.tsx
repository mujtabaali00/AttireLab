import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package } from 'lucide-react'
import { OrderStatus } from '@prisma/client'
import { AdminOrderStatusControl } from '@/components/orders/AdminOrderStatusControl'

export const metadata = { title: 'Order Detail — Admin' }

const statusStyles: Record<OrderStatus, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',     color: 'bg-gray-100 text-gray-700 border-gray-200' },
  PROCESSING: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  SHIPPED:    { label: 'Dispatched',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  DELIVERED:  { label: 'Delivered',   color: 'bg-green-100 text-green-700 border-green-200' },
  CANCELLED:  { label: 'Cancelled',   color: 'bg-red-100 text-red-700 border-red-200' },
}

// Admin access is already enforced by middleware.ts + app/admin/layout.tsx.
export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: {
        include: {
          product: { include: { images: true } },
          specification: true
        }
      }
    }
  })

  if (!order) notFound()

  const address = order.shippingAddress as Record<string, string> | null
  const statusInfo = statusStyles[order.status]

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/orders"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order Detail</h1>
          <p className="text-sm text-gray-500 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
        </div>
        <span className={`ml-auto inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full border ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Summary grid */}
      <div className="bg-white border-y border-gray-100 py-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 px-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</span>
            <span className="text-sm font-semibold text-gray-900">
              {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order #</span>
            <span className="text-sm font-semibold text-gray-900">{order.id.slice(-8).toUpperCase()}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">User</span>
            <span className="text-sm font-semibold text-gray-900">{order.user.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Products</span>
            <span className="text-sm font-semibold text-gray-900">{String(order.items.length).padStart(2, '0')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</span>
            <span className="text-sm font-semibold text-gray-900">Rs {Number(order.total).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">Order Items</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {order.items.map(item => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                <div className="relative w-12 h-12 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                  {item.specification?.imageUrl || item.product.images[0]?.url ? (
                    <Image src={item.specification?.imageUrl || item.product.images[0].url} alt={item.productName} fill className="object-cover" sizes="48px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.productName}</p>
                  {(item.color || item.size) && (
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {[item.color && `Colour: ${item.color}`, item.size && `Size: ${item.size.toUpperCase()}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 shrink-0">
                  Rs {(Number(item.unitPrice) * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>Rs {Number(order.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax (10%)</span>
              <span>Rs {Number(order.tax).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rs {Number(order.total).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Sidebar: shipping + status */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Shipping Address</h2>
            {address && Object.keys(address).length > 0 ? (
              <div className="space-y-1 text-sm text-gray-700">
                {address.fullName && <p className="font-semibold">{address.fullName}</p>}
                {address.address && <p>{address.address}</p>}
                {address.city && <p>{address.city}{address.postalCode ? `, ${address.postalCode}` : ''}</p>}
                {address.country && <p>{address.country}</p>}
                {address.phone && <p className="text-gray-500 text-xs mt-1">📞 {address.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No address provided</p>
            )}
          </div>

          {/* Order status */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Order Status</h2>
            <AdminOrderStatusControl orderId={order.id} status={order.status} />
            <p className="text-xs text-gray-400 mt-2">
              Last updated: {new Date(order.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
