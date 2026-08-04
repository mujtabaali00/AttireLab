export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-white p-10 rounded-xl shadow-md border border-gray-100">
        {children}
      </div>
    </div>
  )
}
