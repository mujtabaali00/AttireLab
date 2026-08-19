'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Bell, ChevronDown, Package, LogOut, ShoppingCart, X, Truck } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'
import { useEffect, useRef, useState, type UIEvent } from 'react'
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

function NotifIcon({ type }: { type: string }) {
  if (type === 'ORDER_CONFIRMED') return (
    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
      <Package className="w-4 h-4 text-green-600" />
    </div>
  )
  if (type === 'ORDER_CANCELLED') return (
    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
      <X className="w-4 h-4 text-red-600" />
    </div>
  )
  if (type === 'ADDED_TO_CART') return (
    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
      <ShoppingCart className="w-4 h-4 text-blue-600" />
    </div>
  )
  if (type === 'SYSTEM') return (
    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
      <Truck className="w-4 h-4 text-orange-600" />
    </div>
  )
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
      <Bell className="w-4 h-4 text-gray-500" />
    </div>
  )
}

function LogoutConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-xs text-center shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Log out?</h3>
        <p className="text-sm text-gray-500 mb-5">Are you sure you want to log out of your account?</p>
        <div className="flex justify-center gap-3">
          <button onClick={onCancel} className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            Stay
          </button>
          <button onClick={onConfirm} className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors">
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export function Navbar() {
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifCursor, setNotifCursor] = useState<string | null>(null)
  const [notifHasMore, setNotifHasMore] = useState(false)
  const [notifLoadingMore, setNotifLoadingMore] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifTab, setNotifTab] = useState<'unread' | 'all'>('unread')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const { getTotalItems, fetchCart, isInitialized } = useCartStore()
  const { data: session } = useSession()
  const pathname = usePathname()

  const isAdminRoute = pathname.startsWith('/admin')

  useEffect(() => {
    setMounted(true)
    if (!isInitialized) fetchCart()
  }, [fetchCart, isInitialized])

  // reset=true replaces the list with a fresh first page (initial load, poll,
  // dropdown open); reset=false appends the next page (scroll-to-load-more).
  const fetchNotifications = async (reset = true) => {
    if (!session?.user) return
    if (!reset && notifLoadingMore) return
    if (!reset) setNotifLoadingMore(true)
    try {
      const cursor = reset ? '' : notifCursor
      const url = cursor ? `/api/notifications?cursor=${cursor}` : '/api/notifications'
      const res = await fetch(url)
      const data = await res.json()
      if (data.data) {
        const { notifications: page, nextCursor, unreadCount: count } = data.data
        setNotifications(prev => reset ? page : [...prev, ...page])
        setNotifCursor(nextCursor)
        setNotifHasMore(!!nextCursor)
        setUnreadCount(count)
      }
    } catch { }
    finally {
      if (!reset) setNotifLoadingMore(false)
    }
  }

  const handleNotifScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80 && notifHasMore && !notifLoadingMore) {
      fetchNotifications(false)
    }
  }

  useEffect(() => {
    fetchNotifications(true)
    const interval = setInterval(() => fetchNotifications(true), 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  useEffect(() => {
    if (notifOpen) fetchNotifications(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (pathname.startsWith('/auth')) return null

  const displayedNotifs = notifTab === 'unread' ? notifications.filter(n => !n.read) : notifications

  const handleMarkAsRead = async (id?: string) => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      })
      if (id) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } else {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch { }
  }

  // ── Admin navbar (no cart, user avatar top-right) ──
  if (isAdminRoute) {
    return (
      <>
      <nav className="bg-white border-b border-gray-200 h-14 flex items-center px-6 sticky top-0 z-40">
        {/* Left: logo — kept in sync with sidebar */}
        <Link href="/admin/products" className="text-sm font-bold text-gray-900 tracking-tight">
          AttireLab
        </Link>

        <div className="ml-auto flex items-center gap-4">
          {/* Bell */}
          {session && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative text-gray-400 hover:text-blue-500 transition-colors p-1"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h3 className="text-base font-bold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={() => handleMarkAsRead()} className="text-xs text-blue-500 hover:text-blue-600 font-semibold">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="flex border-b border-gray-100 px-4">
                    <button onClick={() => setNotifTab('unread')} className={`pb-2 mr-6 text-sm font-medium border-b-2 transition-colors ${notifTab === 'unread' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      Unread{unreadCount > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5">{unreadCount}</span>}
                    </button>
                    <button onClick={() => setNotifTab('all')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${notifTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      All
                    </button>
                  </div>
                  <div onScroll={handleNotifScroll} className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
                    {displayedNotifs.length === 0 ? (
                      <div className="p-8 text-center"><Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">{notifTab === 'unread' ? 'All caught up!' : 'No notifications yet'}</p></div>
                    ) : (
                      <>
                        {displayedNotifs.map(notif => (
                          <div key={notif.id} onClick={() => { if (!notif.read) handleMarkAsRead(notif.id) }} className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 flex items-start gap-3 ${!notif.read ? 'bg-blue-50/40' : ''}`}>
                            <NotifIcon type={notif.type} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${!notif.read ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{notif.message}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}</p>
                            </div>
                            {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                          </div>
                        ))}
                        {notifLoadingMore && (
                          <div className="p-3 text-center text-xs text-gray-400">Loading more...</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin user avatar + name */}
          {session && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {session.user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AU'}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:inline">{session.user?.name}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-gray-100 shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-50 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{session.user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{session.user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true) }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 font-medium hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => signOut({ callbackUrl: '/auth/login' })}
        />
      )}
      </>
    )
  }

  // ── User navbar ──
  return (
    <>
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href="/" className="text-base font-bold text-blue-600 tracking-tight">
            Attirelab
          </Link>

          <div className="flex items-center gap-4">
            {/* Cart */}
            <Link href="/cart" className="relative text-gray-500 hover:text-blue-500 transition-colors">
              <ShoppingBag className="w-5 h-5" />
              {mounted && getTotalItems() > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-tight">
                  {getTotalItems()}
                </span>
              )}
            </Link>

            {/* Bell */}
            {session && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative text-gray-500 hover:text-blue-500 transition-colors p-1"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border border-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <h3 className="text-base font-bold text-gray-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={() => handleMarkAsRead()} className="text-xs text-blue-500 hover:text-blue-600 font-semibold">
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="flex border-b border-gray-100 px-4">
                      <button onClick={() => setNotifTab('unread')} className={`pb-2 mr-6 text-sm font-medium border-b-2 transition-colors ${notifTab === 'unread' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        Unread{unreadCount > 0 && <span className="ml-1 text-xs bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5">{unreadCount}</span>}
                      </button>
                      <button onClick={() => setNotifTab('all')} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${notifTab === 'all' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        All
                      </button>
                    </div>
                    <div onScroll={handleNotifScroll} className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
                      {displayedNotifs.length === 0 ? (
                        <div className="p-8 text-center"><Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">{notifTab === 'unread' ? 'All caught up!' : 'No notifications yet'}</p></div>
                      ) : (
                        <>
                          {displayedNotifs.map(notif => (
                            <div key={notif.id} onClick={() => { if (!notif.read) handleMarkAsRead(notif.id) }} className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 flex items-start gap-3 ${!notif.read ? 'bg-blue-50/40' : ''}`}>
                              <NotifIcon type={notif.type} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm leading-snug ${!notif.read ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{notif.message}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}</p>
                              </div>
                              {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                            </div>
                          ))}
                          {notifLoadingMore && (
                            <div className="p-3 text-center text-xs text-gray-400">Loading more...</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Login / User menu */}
            {session ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-md transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden relative border border-gray-300">
                    {session.user?.image ? (
                      <Image src={session.user.image} alt={session.user.name || 'User'} fill className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-gray-600 uppercase">
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
                    {session.user?.role === 'ADMIN' && (
                      <Link href="/admin/products" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                        Admin Panel
                      </Link>
                    )}
                    <Link href="/orders" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-500 font-medium hover:bg-blue-50 transition-colors">
                      <Package className="w-4 h-4" /> My Orders
                    </Link>
                    <button onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true) }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 font-medium hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-md transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
    {showLogoutConfirm && (
      <LogoutConfirmModal
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => signOut({ callbackUrl: '/auth/login' })}
      />
    )}
    </>
  )
}
