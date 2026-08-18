import { db } from '@/lib/db'
import Link from 'next/link'
import { ResetPasswordClientForm } from './ResetPasswordClientForm'

export const metadata = { title: 'Reset Password' }

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Invalid Link</h2>
        <p className="text-sm text-gray-500">The password reset link is invalid or missing.</p>
        <Link
          href="/auth/forgot-password"
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors text-sm"
        >
          Reset Password Again
        </Link>
      </div>
    )
  }

  // Check token in DB
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token }
  })

  // If missing, used, or expired
  if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-900">Link is expired</h2>
        <p className="text-sm text-gray-500">
          This password reset link has expired or has already been used.
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors text-sm"
        >
          Reset Password Again
        </Link>
      </div>
    )
  }

  // Valid token — render the actual form client component
  return (
    <div className="">
      <ResetPasswordClientForm token={token} />
    </div>
  )
}
