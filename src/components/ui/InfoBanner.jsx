import { Info } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function InfoBanner({ children, className }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900',
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
      <div>{children}</div>
    </div>
  )
}
