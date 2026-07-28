import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-linear-to-br from-azure to-[color-mix(in_oklab,var(--azure)_70%,var(--teal))] text-primary-foreground shadow-[0_10px_30px_-10px_color-mix(in_oklab,var(--azure)_75%,transparent)] hover:brightness-110 active:brightness-95",
        glass: "glass-subtle text-foreground hover:bg-white/12 hover:border-white/20 active:bg-white/8 rounded-lg",
        outline: "border border-white/15 bg-transparent text-foreground hover:bg-white/8",
        ghost: "text-muted-foreground hover:bg-white/8 hover:text-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-110",
        link: "text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-md px-3 text-[13px]",
        lg: "h-12 px-7 text-[15px]",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { buttonVariants }
