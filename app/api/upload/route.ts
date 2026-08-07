import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { saveImageLocally, deleteLocalImage } from '@/lib/local-upload'

// POST /api/upload — ADMIN only, multipart/form-data
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return apiError('No files provided', 400)
    }

    if (files.length > 5) {
      return apiError('Maximum 5 images allowed', 400)
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const urls: string[] = []

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return apiError(`Invalid file type: ${file.type}. Allowed: jpg, png, webp`, 400)
      }

      if (file.size > 5 * 1024 * 1024) {
        return apiError(`File too large: ${file.name}. Max 5MB per image`, 400)
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const url = await saveImageLocally(buffer, file.type)
      urls.push(url)
    }

    return apiSuccess({ urls })
  } catch {
    return apiError('Upload failed', 500)
  }
}

// DELETE /api/upload — ADMIN only
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return apiError('Unauthorized', 401)
    }

    const body = await req.json()
    const { url } = body as { url: string }

    if (!url) {
      return apiError('URL is required', 400)
    }

    await deleteLocalImage(url)
    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Failed to delete image', 500)
  }
}
