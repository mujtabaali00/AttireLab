import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Package } from 'lucide-react'
import { OrderStatus, Prisma } from '@prisma/client'
import { AdminOrderStatusControl } from './AdminOrderStatusControl'
import { formatPrice } from '@/lib/format'
import { ORDER_STATUS_LABELS, ORDER_STATUS_SOLID_COLOR } from '@/lib/order-status'

export const ORDER_DETAIL_INCLUDE = {
  user: true,
  items: {
    include: {
      product: { include: { images: true, specifications: true } },
      specification: true,
    },
  },
} satisfies Prisma.OrderInclude

export type OrderDetailData = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>

const STATUS_ORDER: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

export function OrderDetailView({ order, variant }: { order: OrderDetailData; variant: 'admin' | 'customer' }) {
  const isAdmin = variant === 'admin'
  const address = order.shippingAddress as Record<string, string> | null
  const statusInfo = { label: ORDER_STATUS_LABELS[order.status], color: ORDER_STATUS_SOLID_COLOR[order.status] }

  return (
    <div className={isAdmin ? 'p-6 lg:p-8 max-w-5xl' : 'max-w-5xl mx-auto py-6 px-4 sm:px-0'}>
      {/* Header */}
      {isAdmin ? (
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/orders" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Detail</h1>
            <p className="text-sm text-gray-500 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      ) : (
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
      )}

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
          {isAdmin ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">User</span>
              <span className="text-sm font-semibold text-gray-900">{order.user.name}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
              <span className="text-sm font-semibold text-gray-900">{statusInfo.label}</span>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Number of Products</span>
            <span className="text-sm font-semibold text-gray-900">{String(order.items.length).padStart(2, '0')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</span>
            <span className="text-sm font-semibold text-gray-900">Rs {formatPrice(Number(order.total))}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className={`lg:col-span-2 border border-gray-200 rounded-xl overflow-hidden ${isAdmin ? 'bg-white' : ''}`}>
          <div className={`px-5 py-4 border-b border-gray-100 ${isAdmin ? '' : 'bg-gray-50'}`}>
            <h2 className="text-sm font-bold text-gray-900">{isAdmin ? 'Order Items' : 'Items Ordered'}</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {order.items.map(item => {
              // Legacy orders (placed before the variant-based cart/order refactor) have no
              // specificationId FK, only a snapshotted color string — match it against the
              // product's current specifications so the right variant photo still shows.
              const legacyColorMatch = !item.specification && item.color
                ? item.product.specifications.find(s => s.color === item.color && s.imageUrl)
                : undefined
              const displayImage = item.specification?.imageUrl || legacyColorMatch?.imageUrl || item.product.images[0]?.url
              return (
                <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="relative w-12 h-12 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                    {displayImage ? (
                      <Image src={displayImage} alt={item.productName} fill className="object-cover" sizes="48px" />
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      Qty: {item.quantity}{!isAdmin && ` × Rs ${formatPrice(Number(item.unitPrice))}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    Rs {formatPrice(Number(item.unitPrice) * item.quantity)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Price breakdown */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>Rs {formatPrice(Number(order.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax (10%)</span>
              <span>Rs {formatPrice(Number(order.tax))}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>Rs {formatPrice(Number(order.total))}</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Shipping address */}
          <div className={`border border-gray-200 rounded-xl p-5 ${isAdmin ? 'bg-white' : ''}`}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">{isAdmin ? 'Shipping Address' : 'Delivery Address'}</h2>
            {address && Object.keys(address).length > 0 ? (
              <div className="space-y-1 text-sm text-gray-700">
                {address.fullName && <p className="font-semibold">{address.fullName}</p>}
                {address.address && <p>{address.address}</p>}
                {address.city && <p>{address.city}{address.postalCode ? `, ${address.postalCode}` : ''}</p>}
                {address.country && <p>{address.country}</p>}
                {address.phone && <p className="text-gray-500 text-xs mt-1">📞 {address.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">{isAdmin ? 'No address provided' : 'No address on file'}</p>
            )}
          </div>

          {/* Order status */}
          <div className={`border border-gray-200 rounded-xl p-5 ${isAdmin ? 'bg-white' : ''}`}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">Order Status</h2>
            {isAdmin ? (
              <>
                <AdminOrderStatusControl orderId={order.id} status={order.status} />
                <p className="text-xs text-gray-400 mt-2">
                  Last updated: {new Date(order.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                {(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as OrderStatus[]).map((s) => {
                  const currentIdx = STATUS_ORDER.indexOf(order.status)
                  const thisIdx = STATUS_ORDER.indexOf(s)
                  const isActive = order.status === 'CANCELLED' ? false : thisIdx <= currentIdx
                  const isCurrent = order.status === s

                  return (
                    <div key={s} className={`flex items-center gap-2 text-xs ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-blue-500' : isActive ? 'bg-green-500' : 'bg-gray-200'}`} />
                      <span className={isCurrent ? 'font-semibold' : ''}>{ORDER_STATUS_LABELS[s]}</span>
                    </div>
                  )
                })}
                {order.status === 'CANCELLED' && (
                  <div className="flex items-center gap-2 text-xs text-red-500">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                    <span className="font-semibold">{ORDER_STATUS_LABELS.CANCELLED}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
