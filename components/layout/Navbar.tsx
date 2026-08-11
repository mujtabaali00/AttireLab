'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Bell, ChevronDown, Package, LogOut, Check } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'
import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export function Navbar() {
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  
  const { getTotalItems, fetchCart, isInitialized } = useCartStore()
  const { data: session } = useSession()
  const pathname = usePathname()
  
  const isAdminRoute = pathname.startsWith('/admin')

  useEffect(() => {
    setMounted(true)
    if (!isInitialized) {
      fetchCart()
    }
  }, [fetchCart, isInitialized])

  useEffect(() => {
    if (session?.user) {
      fetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          if (data.data) setNotifications(data.data)
        })
        .catch(() => {})
    }
  }, [session, notifOpen])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (pathname.startsWith('/auth')) {
    return null
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const handleMarkAsRead = async (id?: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {})
      })
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
    } catch {}
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href={isAdminRoute ? '/admin/orders' : '/'} className="text-base font-semibold text-gray-900 tracking-tight">
            Attire Lab
          </Link>

          <div className="flex items-center space-x-4">
            {!isAdminRoute && (
              <Link href="/cart" className="relative text-gray-500 hover:text-blue-500 transition-colors">
                <ShoppingBag className="w-5 h-5" />
                {mounted && getTotalItems() > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-tight">
                    {getTotalItems()}
                  </span>
                )}
              </Link>
            )}

            {session && (
              <div className="relative" ref={notifRef}>
                <button 
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative text-gray-500 hover:text-blue-500 transition-colors p-1"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white" />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-gray-100 shadow-xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={() => handleMarkAsRead()} className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">No notifications yet</div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {notifications.map(notif => (
                            <div 
                              key={notif.id} 
                              onClick={() => { if(!notif.read) handleMarkAsRead(notif.id) }}
                              className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${!notif.read ? 'bg-blue-50/30' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                <div>
                                  <p className={`text-sm ${!notif.read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                    {notif.message}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {session ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-md transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden relative border border-gray-300">
                    {session.user?.image ? (
                      <Image src={session.user.image} alt={session.user.name || 'User'} fill className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-500 uppercase">
                        {session.user?.name?.[0] || 'U'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:inline">{session.user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-50 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{session.user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                    </div>
                    {session.user?.role === 'ADMIN' && !isAdminRoute && (
                      <Link href="/admin/products" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        Admin Panel
                      </Link>
                    )}
                    <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-500 font-medium hover:bg-blue-50 transition-colors">
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                    <button onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/auth/login' }) }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 font-medium hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/login" className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
