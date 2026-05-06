import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neu-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 will-change-neu",
  {
    variants: {
      variant: {
        default:
          "bg-neu-bg text-neu-accent nm-flat hover:nm-sm active:nm-inset active:scale-[0.98]",
        destructive:
          "bg-rose-500 text-white shadow-lg active:scale-[0.98]",
        outline:
          "border border-neu-dark/20 bg-transparent text-neu-text hover:bg-neu-bg hover:nm-sm active:nm-inset",
        secondary:
          "bg-neu-bg text-neu-text nm-sm hover:nm-flat active:nm-inset",
        ghost: "hover:bg-neu-dark/10 text-neu-text",
        link: "text-neu-accent underline-offset-4 hover:underline",
        neumorphic: "bg-neu-bg text-neu-accent nm-flat active:nm-inset",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-xl px-4 text-xs",
        lg: "h-14 rounded-neu px-10 text-base",
        icon: "h-11 w-11 rounded-2xl nm-flat active:nm-inset flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
