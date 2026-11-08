import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const STYLES: Record<Variant, string> = {
  primary: 'bg-accent text-bg font-semibold',
  secondary: 'bg-surface ring-1 ring-line',
  ghost: 'text-slate-300',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40',
}

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-12 rounded-xl px-4 text-base disabled:opacity-50 active:scale-[0.98] ${STYLES[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-surface p-4 ring-1 ring-line ${className}`}>{children}</div>
}
