import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const STYLES: Record<Variant, string> = {
  primary: 'bg-accent-solid text-on-accent font-bold',
  secondary: 'bg-raised font-medium ring-1 ring-line',
  ghost: 'text-slate-300',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40',
}

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`min-h-13 rounded-2xl px-4 text-base disabled:opacity-40 active:scale-[0.98] ${STYLES[variant]} ${className}`}
      {...rest}
    />
  )
}

/** Un <Link> con la misma cara que un Button secundario. */
export const LINK_BUTTON = 'flex min-h-13 items-center justify-center rounded-2xl bg-raised px-4 font-medium ring-1 ring-line active:scale-[0.98]'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface p-4 ring-1 ring-line ${className}`}>{children}</div>
}
