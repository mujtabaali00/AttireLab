import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Order Detail' }

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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <div className="mb-5">
        <Link href="/orders" className="inline-flex items-center text-[#1a237e] hover:text-blue-800 font-semibold text-lg">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Order Detail
        </Link>
      </div>

      {/* Order summary row — responsive grid */}
      <div className="border-t border-b border-gray-200 py-5 mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-4 gap-x-4">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Date</p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Order #</p>
          <p className="text-sm font-medium text-gray-900 font-mono">{order.id.slice(-6).toUpperCase()}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">User</p>
          <p className="text-sm font-medium text-gray-900">{order.user.name}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Products</p>
          <p className="text-sm font-medium text-gray-900">{order.items.length.toString().padStart(2, '0')}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Amount</p>
          <p className="text-sm font-medium text-gray-900">${Number(order.total).toFixed(2)}</p>
        </div>
      </div>

      {/* Product Information */}
      <h3 className="text-base font-semibold text-[#1a237e] mb-4">Product Information</h3>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="min-w-[500px] px-4 sm:px-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-400">
                <th className="pb-3 font-medium">Title</th>
                <th className="pb-3 font-medium text-right">Price</th>
                <th className="pb-3 font-medium text-center">Quantity</th>
                <th className="pb-3 font-medium text-center">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map(item => (
                <tr key={item.id} className="text-xs sm:text-sm">
                  <td className="py-3">
                    <div className="flex items-start gap-2">
                      <div className="relative w-10 h-10 bg-gray-50 rounded overflow-hidden shrink-0 mt-0.5">
                        {item.product.images[0]?.url ? (
                          <Image
                            src={item.product.images[0].url}
                            alt={item.productName}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : <div className="w-full h-full bg-gray-200" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 line-clamp-2 leading-tight max-w-[200px] sm:max-w-xs">
                          {item.productName}
                        </p>
                        {(item.color || item.size) && (
                          <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                            {item.color && `Color: ${item.color}`}
                            {item.color && item.size && ' | '}
                            {item.size && `Size: ${item.size}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 text-right font-medium">
                    ${Number(item.unitPrice).toFixed(2)}
                  </td>
                  <td className="py-3 text-gray-600 text-center">
                    {item.quantity.toString().padStart(2, '0')}
                  </td>
                  <td className="py-3 text-gray-600 text-center">
                    {item.product.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
