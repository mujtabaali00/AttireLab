'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProductSchema } from '@/lib/validations/product.schema'
import { z } from 'zod'
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  ImageIcon,
  CheckCircle,
  PlusCircle,
  Trash2,
  Info
} from 'lucide-react'

type FormValues = z.infer<typeof createProductSchema>

interface Category {
  id: string
  name: string
  slug: string
}

interface EditProductFormProps {
  productId: string
  initialData: FormValues
}

export function EditProductForm({ productId, initialData }: EditProductFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(initialData.imageUrls)
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [serverError, setServerError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [specUploadStates, setSpecUploadStates] = useState<Record<number, boolean>>({})

  // Category creation
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState('')

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: initialData,
  })

  const { fields: specFields, append: appendSpec, remove: removeSpec } = useFieldArray({
    control,
    name: 'specifications',
  })

  const specifications = watch('specifications')

  // Auto-sum quantity when specs have actual data entered
  useEffect(() => {
    if (specifications && specifications.length > 0) {
      const hasAnyQty = specifications.some(s => Number(s.quantity) > 0)
      if (hasAnyQty) {
        const sum = specifications.reduce((acc, spec) => acc + (Number(spec.quantity) || 0), 0)
        setValue('quantity', sum)
      }
    }
  }, [specifications, setValue])

  useEffect(() => {
    setValue('imageUrls', uploadedUrls)
  }, [uploadedUrls, setValue])

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => setCategories(data.data || []))
      .catch(() => {})
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    if (uploadedUrls.length + files.length > 5) {
      setUploadError('Maximum 5 images allowed')
      return
    }

    setUploadError('')
    setIsUploading(true)

    const formData = new FormData()
    files.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed')
      } else {
        setUploadedUrls(prev => [...prev, ...data.data.urls])
      }
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSpecImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSpecUploadStates(prev => ({ ...prev, [index]: true }))

    const formData = new FormData()
    formData.append('files', file)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setValue(`specifications.${index}.imageUrl`, data.data.urls[0])
      }
    } catch {
      alert('Upload failed')
    } finally {
      setSpecUploadStates(prev => ({ ...prev, [index]: false }))
    }
  }

  const removeImage = async (url: string) => {
    setUploadedUrls(prev => prev.filter(u => u !== url))
    fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {})
  }

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    setIsSavingCategory(true)
    setCategoryError('')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCategoryError(data.error || 'Failed to create category')
        return
      }
      const created = data.data
      setCategories(prev => [...prev, created])
      setValue('categoryId', created.id)
      setNewCategoryName('')
      setIsCreatingCategory(false)
    } catch {
      setCategoryError('Network error. Please try again.')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const onSubmit = async (data: FormValues) => {
    if (uploadedUrls.length === 0) {
      setServerError('Please upload at least one product image.')
      return
    }

    setIsSubmitting(true)
    setServerError('')

    const cleanedData = {
      ...data,
      specifications: data.specifications?.map(spec => ({
        ...spec,
        color: spec.color || undefined,
        size: spec.size || undefined,
        price: spec.price || undefined,
        imageUrl: spec.imageUrl || undefined,
      })),
    }

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      const result = await res.json()

      if (!res.ok) {
        setServerError(result.error || 'Failed to update product')
        return
      }

      setSuccessMessage('Product updated successfully! Redirecting...')
      setTimeout(() => router.push('/admin/products'), 1500)
    } catch {
      setServerError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasSpecs = specFields.length > 0

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/products"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-sm text-gray-500 mt-0.5">Update product details and specifications</p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-5 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm font-medium">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {serverError && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* General Images */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Product Images <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-4">Upload up to 5 images. The first image is the main display image.</p>

          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              isUploading
                ? 'border-blue-300 bg-blue-50 cursor-wait'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || uploadedUrls.length >= 5}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-sm text-blue-600 font-medium">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Click to upload images</p>
              </div>
            )}
          </div>

          {uploadError && <p className="mt-1.5 text-xs text-red-500">{uploadError}</p>}

          {uploadedUrls.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {uploadedUrls.map((url, i) => (
                <div key={url} className="relative group">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover" sizes="80px" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-blue-500/80 text-white text-[9px] font-bold text-center py-0.5 rounded-b-lg">
                      MAIN
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Base Price (Rs) <span className="text-red-500">*</span>
              </label>
              <input
                {...register('price', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Category <span className="text-red-500">*</span>
                </label>
                {!isCreatingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    + New Category
                  </button>
                )}
              </div>

              {isCreatingCategory ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="e.g. Jackets, Shoes..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleCreateCategory()
                        }
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={isSavingCategory || !newCategoryName.trim()}
                      className="px-3 py-2 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {isSavingCategory ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); setCategoryError('') }}
                      className="px-3 py-2 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  {categoryError && <p className="text-xs text-red-500">{categoryError}</p>}
                </div>
              ) : (
                <select
                  {...register('categoryId')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
              {errors.categoryId && <p className="mt-1 text-xs text-red-500">{errors.categoryId.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Total Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                {...register('quantity', { valueAsNumber: true })}
                type="number"
                min="0"
                step="1"
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${hasSpecs ? 'bg-gray-50 text-gray-500' : 'bg-white'}`}
                readOnly={hasSpecs}
              />
              {hasSpecs && (
                <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Auto-calculated from variant quantities below
                </p>
              )}
              {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>}
            </div>
          </div>
        </div>



        {/* Specifications */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Product Variants (Optional)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Add colour/size variants. Leave empty for products with no variants.</p>
            </div>
            <button
              type="button"
              onClick={() => appendSpec({ quantity: 0 })}
              className="text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Variant
            </button>
          </div>

          {specFields.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="font-medium text-gray-500 mb-1">No variants added</p>
              <p className="text-xs">Products without variants use the base price & stock above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {specFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="col-span-12 sm:col-span-2 flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase">Image</label>
                    <div className="relative w-14 h-14 bg-white rounded-md border border-gray-300 flex items-center justify-center overflow-hidden group cursor-pointer">
                      {watch(`specifications.${index}.imageUrl`) ? (
                        <>
                          <Image src={watch(`specifications.${index}.imageUrl`)!} alt="Variant" fill className="object-cover" sizes="56px" />
                          <button
                            type="button"
                            onClick={() => setValue(`specifications.${index}.imageUrl`, undefined)}
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : specUploadStates[index] ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : (
                        <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center hover:bg-gray-50 gap-1">
                          <ImageIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-[9px] text-gray-400">Upload</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => handleSpecImageChange(index, e)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Colour</label>
                      <select {...register(`specifications.${index}.color`)} className="w-full border border-gray-300 rounded text-xs px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">— Any —</option>
                        <option value="red">Red</option>
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="yellow">Yellow</option>
                        <option value="brown">Brown</option>
                        <option value="grey">Grey</option>
                        <option value="black">Black</option>
                        <option value="white">White</option>
                        <option value="navy">Navy</option>
                        <option value="maroon">Maroon</option>
                        <option value="pink">Pink</option>
                        <option value="purple">Purple</option>
                        <option value="orange">Orange</option>
                        <option value="beige">Beige</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Size</label>
                      <select {...register(`specifications.${index}.size`)} className="w-full border border-gray-300 rounded text-xs px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="">— Any —</option>
                        <option value="xs">XS</option>
                        <option value="s">S</option>
                        <option value="m">M</option>
                        <option value="l">L</option>
                        <option value="xl">XL</option>
                        <option value="xxl">XXL</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">
                        Stock <span className="text-red-400">*</span>
                      </label>
                      <input
                        {...register(`specifications.${index}.quantity`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full border border-gray-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Price (Rs)</label>
                      <input
                        {...register(`specifications.${index}.price`, { valueAsNumber: true, setValueAs: v => v === '' ? undefined : Number(v) })}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Base"
                        className="w-full border border-gray-300 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-1 flex justify-end sm:justify-center sm:pt-5">
                    <button type="button" onClick={() => removeSpec(index)} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/admin/products"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isUploading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-8 py-2.5 rounded-lg transition-colors ml-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
