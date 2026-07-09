import Badge from '@/components/ui/Badge'
import { getLineageBannerMessage } from '@/utils/lineage'

const TYPE_VARIANT = {
  RECURRING: 'primary',
  FOLLOW_UP: 'info',
}

export default function LineageBanner({ lineage, timezone = 'UTC' }) {
  const message = getLineageBannerMessage(lineage, timezone)
  if (!message) return null

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {lineage?.type && (
          <Badge variant={TYPE_VARIANT[lineage.type] ?? 'default'} className="text-[10px] font-bold uppercase">
            {lineage.type.replace('_', ' ')}
          </Badge>
        )}
        <p className="text-sm font-medium text-primary-900">{message}</p>
      </div>
    </div>
  )
}
