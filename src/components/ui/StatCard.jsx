import { cn } from '@/utils/cn'

export default function StatCard({ label, value, icon: Icon, iconClassName, loading }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          iconClassName,
        )}
      >
        {Icon && <Icon className="h-6 w-6" />}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-1 h-7 w-16 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        )}
      </div>
    </div>
  )
}
