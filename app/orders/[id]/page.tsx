import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package } from 'lucide-react'
import { OrderStatus } from '@prisma/client'

export const metadata = { title: 'Order Detail' }

const statusStyles: Record<OrderStatus, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',     color: 'bg-gray-100 text-gray-700' },
  PROCESSING: { label: 'In Progress', color: 'bg-yellow-400 text-white' },
  SHIPPED:    { label: 'Dispatched',  color: 'bg-blue-500 text-white' },
  DELIVERED:  { label: 'Delivered',   color: 'bg-green-500 text-white' },
  CANCELLED:  { label: 'Rejected',    color: 'bg-red-500 text-white' },
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: {
        include: {
          product: { include: { images: true } }
        }
      }
    }
  })

  if (!order) notFound()
  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') redirect('/orders')

  const address = order.shippingAddress as Record<string, string> | null
  const statusInfo = statusStyles[order.status]

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/orders" className="inline-flex items-center text-blue-500 hover:text-blue-600 font-medium text-2xl tracking-tight transition-colors">
            <span className="mr-3 font-normal">&larr;</span> Order Detail
          </Link>
          <span className="text-lg text-gray-300 font-light hidden sm:inline-block">|</span>
          <span className="text-sm font-mono text-gray-500 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100 hidden sm:inline-block">
            #{order.id.slice(-8).toUpperCase()}
          </span>
        </div>
        <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded ${statusInfo.color}`}>
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
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <span className="text-sm font-semibold text-gray-900">{statusInfo.label}</span>
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
        {/* Items */}
        <div className="lg:col-span-2 border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-900">Items Ordered</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {order.items.map(item => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                <div className="relative w-12 h-12 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                  {item.product.images[0]?.url ? (
                    <Image src={item.product.images[0].url} alt={item.productName} fill className="object-cover" sizes="48px" />
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
                  <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity} × Rs {Number(item.unitPrice).toLocaleString()}</p>
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

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Delivery Address</h2>
            {address && Object.keys(address).length > 0 ? (
              <div className="space-y-1 text-sm text-gray-700">
                {address.fullName && <p className="font-semibold">{address.fullName}</p>}
                {address.address && <p>{address.address}</p>}
                {address.city && <p>{address.city}{address.postalCode ? `, ${address.postalCode}` : ''}</p>}
                {address.country && <p>{address.country}</p>}
                {address.phone && <p className="text-gray-500 text-xs mt-1">📞 {address.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No address on file</p>
            )}
          </div>

          {/* Status timeline hint */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Order Status</h2>
            <div className="space-y-2">
              {(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as OrderStatus[]).map((s, i) => {
                const statuses: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']
                const currentIdx = statuses.indexOf(order.status)
                const thisIdx = statuses.indexOf(s)
                const isActive = order.status === 'CANCELLED' ? false : thisIdx <= currentIdx
                const isCurrent = order.status === s

                return (
                  <div key={s} className={`flex items-center gap-2 text-xs ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-blue-500' : isActive ? 'bg-green-500' : 'bg-gray-200'}`} />
                    <span className={isCurrent ? 'font-semibold' : ''}>{statusStyles[s].label}</span>
                  </div>
                )
              })}
              {order.status === 'CANCELLED' && (
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                  <span className="font-semibold">Cancelled</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
