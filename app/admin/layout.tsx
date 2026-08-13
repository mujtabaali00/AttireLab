import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export const metadata = {
  title: { template: '%s | AttireLab Admin', default: 'Admin Dashboard' },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session || session.user?.role !== 'ADMIN') {
    redirect('/auth/login')
  }

  return (
    // The root layout already renders the Navbar (which handles /admin routes separately).
    // Here we just add the sidebar alongside the content.
    <div className="flex min-h-[calc(100vh-56px)] bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
