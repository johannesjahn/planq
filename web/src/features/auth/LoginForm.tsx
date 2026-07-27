import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRightIcon } from "lucide-react"
import { motion } from "motion/react"
import { useForm } from "react-hook-form"
import { FormAlert } from "@/components/FormAlert"
import { PasswordInput } from "@/components/PasswordInput"
import { SubmitButton } from "@/components/SubmitButton"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { api, type ApiError } from "@/lib/api"
import { useAuth } from "./auth-context"
import { loginSchema, type LoginValues } from "./schemas"

/** Fields fly in one after another rather than all at once — cheap, and it reads as considered. */
const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } } }
const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const auth = useAuth()
  const navigate = useNavigate()

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
    mode: "onSubmit"
  })

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: (response) => {
      auth.signIn(response)
      void navigate({ to: redirectTo ?? "/", replace: true })
    },
    onError: () => {
      // Never leave a password sitting in the DOM after a rejected attempt.
      form.resetField("password")
      form.setFocus("password")
    }
  })

  const error = mutation.error as ApiError | null

  return (
    <div className="mt-7">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <h2 className="text-[22px] font-semibold tracking-tight">Welcome back</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Sign in to pick up where you left off.</p>
      </motion.div>

      <div className="mt-6">
        <FormAlert message={error ? error.message : null} />
      </div>

      <Form {...form}>
        <motion.form
          variants={container}
          initial="hidden"
          animate="visible"
          onSubmit={(event) => void form.handleSubmit((values) => mutation.mutate(values))(event)}
          className="space-y-5"
          noValidate
        >
          <motion.div variants={item}>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="ada_lovelace" autoComplete="username" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={item}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={item} className="pt-1">
            <SubmitButton pending={mutation.isPending} pendingLabel="Signing in…">
              Sign in
              <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </SubmitButton>
          </motion.div>
        </motion.form>
      </Form>
    </div>
  )
}
