import { put, del } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/lib/logger'

/**
 * Uploads an image buffer to Vercel Blob storage.
 * Returns the permanent public CDN URL.
 */
export async function uploadImageToBlob(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg'
  const fileName = `products/${uuidv4()}.${extension}`

  const blob = await put(fileName, buffer, {
    access: 'public',
    contentType: mimeType,
  })

  return blob.url
}

/**
 * Deletes an image from Vercel Blob by its URL.
 * Silently handles legacy local /uploads/ paths too.
 */
export async function deleteBlobImage(url: string): Promise<void> {
  // Only delete if it's a real Vercel Blob URL
  if (!url.startsWith('https://') || !url.includes('blob.vercel-storage.com')) {
    // Try legacy local delete silently
    if (url.startsWith('/uploads/')) {
      try {
        const { unlink } = await import('fs/promises')
        const { join } = await import('path')
        await unlink(join(process.cwd(), 'public', url))
      } catch { /* Ignore */ }
    }
    return
  }

  try {
    await del(url)
  } catch (error) {
    logger.error({ error, url }, 'Failed to delete Vercel Blob image')
  }
}
