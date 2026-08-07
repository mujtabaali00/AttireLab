'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Bell, ChevronDown } from 'lucide-react'
import { useCartStore } from '@/lib/store/cart.store'
import { useEffect, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export function Navbar() {
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const totalItems = useCartStore((state) => state.getTotalItems())
  const { data: session } = useSession()
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Don't show navbar on auth or admin routes
  if (pathname.startsWith('/auth') || pathname.startsWith('/admin')) {
    return null
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <Link href="/" className="text-base font-semibold text-gray-900 tracking-tight">
            Attire Lab
          </Link>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Cart icon with badge */}
            <Link href="/cart" className="relative text-gray-500 hover:text-blue-500 transition-colors">
              <ShoppingBag className="w-5 h-5" />
              {mounted && totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center leading-tight">
                  {totalItems}
                </span>
              )}
            </Link>

            {/* Bell icon */}
            <button className="text-gray-500 hover:text-blue-500 transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            {/* User menu / Login */}
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
                                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-md border border-gray-200 shadow-lg py-1 z-50">
                    <p className="px-3 py-1.5 text-xs text-gray-400 font-medium border-b border-gray-100 truncate">
                      {session.user?.name}
                    </p>
                    {session.user?.role === 'ADMIN' && (
                      <Link
                        href="/admin/products"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-blue-600 font-medium hover:bg-gray-50"
                      >
                        Admin Panel
                      </Link>
                    )}
                    <Link
                      href="/orders"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      My Orders
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/auth/login' }) }}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50"
                    >
                      Logout
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
