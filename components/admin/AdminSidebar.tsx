'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, ClipboardList } from 'lucide-react'

const navItems = [
  { label: 'Products', href: '/admin/products', icon: LayoutGrid },
  { label: 'Orders', href: '/admin/orders', icon: ClipboardList },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    // Collapses to an icon-only rail below md so it doesn't eat the viewport on mobile.
    <aside className="w-14 md:w-44 shrink-0 bg-white border-r border-gray-200 flex flex-col min-h-screen transition-[width] duration-200">

      {/* Nav */}
      <nav className="flex-1 px-2 md:px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center md:justify-start gap-3 px-0 md:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
