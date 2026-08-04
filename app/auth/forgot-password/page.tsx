"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { forgotPasswordSchema } from "@/lib/validations/auth.schema"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import { z } from "zod"

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [resetUrl, setResetUrl] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true)
    setError("")
    setSuccess("")
    setResetUrl("")

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "An error occurred.")
      } else {
        setSuccess("Reset Password instructions has been sent to your email address.")
        if (result.data?.resetUrl) {
          setResetUrl(result.data.resetUrl)
        }
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-blue-500">Forgot Password</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-3 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 text-sm rounded-md border border-green-200">
          {success}
          {resetUrl && (
            <div className="mt-2 text-xs break-all">
              <span className="font-semibold text-gray-700">Dev Reset Link:</span>{" "}
              <Link href={resetUrl} className="text-blue-600 underline">
                {resetUrl}
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="email">Enter email address</Label>
          <Input 
            id="email" 
            placeholder="Please enter your email" 
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

        <Button disabled={isLoading} type="submit" className="w-full">
          {isLoading ? "Sending..." : "Forgot Password"}
        </Button>
      </form>

      <div className="flex flex-col space-y-2 text-center text-xs">
        <Link href="/auth/login" className="text-blue-500 hover:underline">
          Try remember password? Login
        </Link>
      </div>
    </div>
  )
}
