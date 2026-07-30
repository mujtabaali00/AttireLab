import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200): Response {
  return NextResponse.json({ data }, { status })
}

export function apiError(message: string, status = 400, details?: unknown): Response {
  return NextResponse.json({ error: message, details }, { status })
}
