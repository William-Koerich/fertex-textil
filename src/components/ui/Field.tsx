import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export const inputClass = (invalid?: boolean) =>
  `block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none sm:text-sm dark:bg-slate-900 dark:text-slate-100 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/30 dark:border-slate-700'
  }`

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode
}

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId()
  const descId = error || hint ? `${id}-desc` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': descId })}
      {error ? (
        <p id={descId} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }

export function Input({ label, error, hint, className = '', ...rest }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a11y) => <input {...a11y} {...rest} className={`${inputClass(!!error)} ${className}`} />}
    </Field>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }

export function Textarea({ label, error, hint, className = '', ...rest }: TextareaProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a11y) => <textarea {...a11y} {...rest} className={`${inputClass(!!error)} ${className}`} />}
    </Field>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }

export function Select({ label, error, hint, className = '', children, ...rest }: SelectProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(a11y) => (
        <select {...a11y} {...rest} className={`${inputClass(!!error)} ${className}`}>
          {children}
        </select>
      )}
    </Field>
  )
}
