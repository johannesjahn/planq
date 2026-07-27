import { Slot } from "@radix-ui/react-slot"
import { AnimatePresence, motion } from "motion/react"
import * as React from "react"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues
} from "react-hook-form"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Form = FormProvider

type FormFieldContextValue = { name: string }
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

type FormItemContextValue = { id: string }
const FormItemContext = React.createContext<FormItemContextValue | null>(null)

function FormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>(
  props: ControllerProps<TFieldValues, TName>
) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext?.name as string })

  if (!fieldContext || !itemContext) {
    throw new Error("useFormField must be used within <FormField> and <FormItem>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState
  }
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField()
  return <Label className={cn(error && "text-destructive/90", className)} htmlFor={formItemId} {...props} />
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <Slot
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={Boolean(error)}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()
  return <p id={formDescriptionId} className={cn("text-xs text-muted-foreground/80", className)} {...props} />
}

/**
 * Validation messages slide in rather than appearing instantly — an abrupt layout
 * shift under an input is the single jankiest moment in a sign-up flow.
 */
function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const message = typeof error?.message === "string" ? error.message : undefined
  const body = message ?? children

  return (
    <AnimatePresence initial={false} mode="wait">
      {body ? (
        <motion.p
          key={message ?? "message"}
          id={formMessageId}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn("text-xs font-medium text-destructive/90", className)}
          {...(props as React.ComponentProps<typeof motion.p>)}
        >
          {body}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField }
