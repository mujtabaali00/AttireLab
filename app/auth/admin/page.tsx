"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema } from "@/lib/validations/auth.schema"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { ShieldCheck } from "lucide-react"
import { z } from "zod"

type LoginFormValues = z.infer<typeof loginSchema>

export default function AdminLoginPage() {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true)
    setError("")

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error) {
      setError("Invalid admin credentials. Please try again.")
      return
    }

    const session = await getSession()

    if (session?.user?.role === "ADMIN") {
      router.push("/admin/products")
    } else {
      setError("Access denied: Not an administrator account.")
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center items-center">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-1">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Admin Portal Login</h1>
        <p className="text-sm text-gray-500">Sign in with administrator credentials</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-3 text-sm rounded-md border border-red-200 text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Admin Email</Label>
          <Input
            id="email"
            placeholder="admin@gmail.com"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            placeholder="••••••••"
            type="password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <Button disabled={isLoading} type="submit" className="w-full bg-gray-900 hover:bg-gray-800">
          {isLoading ? "Authenticating..." : "Sign in to Dashboard"}
        </Button>
      </form>

      <div className="text-center text-xs text-gray-500">
        <Link href="/auth/login" className="text-blue-500 hover:underline">
          &larr; Back to Customer Login
        </Link>
      </div>
    </div>
  )
}
