import { auth, signOut } from "@/auth"

export default async function Home() {
  const session = await auth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to AttireLab</h1>
      
      {session?.user ? (
        <div className="mt-8 flex flex-col items-center space-y-4">
          <p className="text-lg">Logged in as: <span className="font-semibold text-blue-600">{session.user.email}</span></p>
          <p className="text-sm text-gray-500">Role: {session.user.role}</p>
          <form
            action={async () => {
              "use server"
              await signOut()
            }}
          >
            <button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center space-y-4">
          <p className="text-xl">The store is currently under construction.</p>
          <a
            href="/auth/login"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
          >
            Log In
          </a>
        </div>
      )}
    </main>
  )
}
