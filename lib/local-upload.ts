import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { extname } from 'path'

export async function saveImageLocally(buffer: Buffer, mimeType: string): Promise<string> {
  const extension = mimeType.split('/')[1] || 'jpg'
  const fileName = `${uuidv4()}.${extension}`
  const filePath = join(process.cwd(), 'public', 'uploads', fileName)
  
  await writeFile(filePath, buffer)
  
  return `/uploads/${fileName}`
}

export async function deleteLocalImage(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return
  
  const fileName = url.replace('/uploads/', '')
  const filePath = join(process.cwd(), 'public', 'uploads', fileName)
  
  try {
    await unlink(filePath)
  } catch (error) {
    console.error(`Failed to delete image at ${filePath}:`, error)
  }
}
