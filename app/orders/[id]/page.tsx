import { auth } from '@/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const order = await db.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      items: {
        include: {
          product: {
            include: { images: true }
          }
        }
      }
    }
  })

  if (!order) {
    notFound()
  }

  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
    redirect('/orders')
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-gray-100 max-w-6xl mx-auto">
      <div className="mb-8">
        <Link href="/orders" className="inline-flex items-center text-[#1a237e] hover:text-blue-700 font-medium text-lg">
          <ArrowLeft className="w-5 h-5 mr-2" /> Order Detail
        </Link>
      </div>

      <div className="border-t border-b border-gray-200 py-6 mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Date</p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Order #</p>
          <p className="text-sm font-medium text-gray-900">{order.id.slice(-6).toUpperCase()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">User</p>
          <p className="text-sm font-medium text-gray-900">{order.user.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Products</p>
          <p className="text-sm font-medium text-gray-900">{order.items.length.toString().padStart(2, '0')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Amount</p>
          <p className="text-sm font-medium text-gray-900">${Number(order.total).toFixed(2)}</p>
        </div>
      </div>

      <h3 className="text-[#1a237e] text-lg font-medium mb-6">Product Information</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 text-sm text-gray-500">
              <th className="pb-4 font-normal w-1/2">Title</th>
              <th className="pb-4 font-normal">Price</th>
              <th className="pb-4 font-normal">Quantity</th>
              <th className="pb-4 font-normal">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <tr key={item.id} className="text-sm">
                <td className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="relative w-12 h-12 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                      {item.product.images[0]?.url ? (
                        <Image src={item.product.images[0].url} alt={item.productName} fill className="object-cover p-1" />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                    </div>
                    <span className="font-medium text-gray-700 max-w-sm line-clamp-2 leading-relaxed">
                      {item.productName}
                      {item.color && item.size && <span className="block text-xs text-gray-400 font-normal mt-0.5 capitalize">Color: {item.color} | Size: {item.size}</span>}
                    </span>
                  </div>
                </td>
                <td className="py-4 text-gray-600">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-4 text-gray-600">{item.quantity.toString().padStart(2, '0')}</td>
                <td className="py-4 text-gray-600">{item.product.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
