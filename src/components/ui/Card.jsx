import { cn } from '@/utils/cn'

export default function Card({ children, className }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }) {
  return <div className={cn('border-b border-slate-100 px-6 py-4', className)}>{children}</div>
}

export function CardBody({ children, className }) {
  return <div className={cn('p-6', className)}>{children}</div>
}
