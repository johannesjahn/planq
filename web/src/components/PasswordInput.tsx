import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Password field with a reveal toggle, so people can check what they typed. */
export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  )
}
