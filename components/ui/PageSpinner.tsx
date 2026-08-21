import { Loader2 } from 'lucide-react'

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )
}
