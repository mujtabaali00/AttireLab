"use client"

import { useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { resetPasswordSchema } from "@/lib/validations/auth.schema"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { z } from "zod"

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") || ""

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token,
    }
  })

  async function onSubmit(data: ResetPasswordFormValues) {
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error || "An error occurred.")
      } else {
        setSuccess("Your password has been updated. Please check your email.")
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
      }
    } catch (err) {
      setError("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center p-4">
        <p className="text-red-500 mb-4">Invalid or missing reset token.</p>
        <Link href="/auth/forgot-password" className="text-blue-500 hover:underline text-sm">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-blue-500">Reset Password</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-3 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 text-sm rounded-md border border-green-200">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Hidden token field */}
        <input type="hidden" {...register("token")} />

        <div className="space-y-1">
          <Label htmlFor="password">Enter new password</Label>
          <Input 
            id="password" 
            placeholder="enter password" 
            type="password" 
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input 
            id="confirmPassword" 
            placeholder="confirm password" 
            type="password" 
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button disabled={isLoading || !!success} type="submit" className="w-full">
          {isLoading ? "Resetting..." : "Reset Password"}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-gray-500">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
