import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Toaster } from 'react-hot-toast'
import { Navbar } from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: { template: '%s | AttireLab', default: 'AttireLab — Premium Clothing' },
  description: 'Shop the latest clothing at AttireLab.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        <Providers>
          <Toaster position="top-center" />
          <Navbar />
          <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
