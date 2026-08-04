import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    let variantStyles = ""
    if (variant === 'primary') {
      variantStyles = "bg-blue-600 text-white shadow hover:bg-blue-700 focus-visible:ring-blue-600"
    } else if (variant === 'outline') {
      variantStyles = "border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 focus-visible:ring-gray-400"
    } else if (variant === 'ghost') {
      variantStyles = "bg-transparent hover:bg-gray-100 text-gray-700 focus-visible:ring-gray-400 shadow-none"
    }

    return (
      <button
        className={
          `inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 w-full ${variantStyles} ${className || ''}`
        }
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
