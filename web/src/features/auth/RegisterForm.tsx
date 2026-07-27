import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { SparklesIcon } from "lucide-react"
import { motion } from "motion/react"
import { useForm, useWatch } from "react-hook-form"
import { FormAlert } from "@/components/FormAlert"
import { PasswordInput } from "@/components/PasswordInput"
import { SubmitButton } from "@/components/SubmitButton"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ApiError, api } from "@/lib/api"
import { useAuth } from "./auth-context"
import { PasswordStrength } from "./PasswordStrength"
import { registerSchema, type RegisterValues } from "./schemas"

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }
const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }
}

export function RegisterForm() {
  const auth = useAuth()
  const navigate = useNavigate()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", password: "", confirmPassword: "" },
    mode: "onSubmit"
  })

  // `useWatch` rather than `form.watch` — it subscribes without re-rendering the
  // whole form on every keystroke, and it is the memoisation-safe API.
  const password = useWatch({ control: form.control, name: "password" })

  const mutation = useMutation({
    mutationFn: ({ username, password: value }: RegisterValues) => api.register({ username, password: value }),
    onSuccess: (response) => {
      // Registration returns a token, so there is no reason to make someone sign in
      // again immediately afterwards.
      auth.signIn(response)
      void navigate({ to: "/", replace: true })
    },
    onError: (error) => {
      // A taken username belongs on the field, not in the banner above the form.
      if (error instanceof ApiError && error.status === 409) {
        form.setError("username", { message: "That username is already taken." })
        form.setFocus("username")
      }
    }
  })

  const error = mutation.error
  const bannerMessage = error instanceof ApiError && error.status !== 409 ? error.message : null

  return (
    <div className="mt-7">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <h2 className="text-[22px] font-semibold tracking-tight">Create your account</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Takes about fifteen seconds. No email required.</p>
      </motion.div>

      <div className="mt-6">
        <FormAlert message={bannerMessage} />
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
                  <FormDescription>3–32 characters. Letters, numbers and underscores.</FormDescription>
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
                    <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <PasswordStrength value={password} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={item}>
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div variants={item} className="pt-1">
            <SubmitButton pending={mutation.isPending} pendingLabel="Creating account…">
              <SparklesIcon />
              Create account
            </SubmitButton>
          </motion.div>
        </motion.form>
      </Form>
    </div>
  )
}
