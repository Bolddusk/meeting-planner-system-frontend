import { formatDateTime } from '@/utils/formatDate'

export const AUDIT_ACTION_VARIANT = {
  CREATED: 'success',
  UPDATED: 'info',
  RESCHEDULED: 'warning',
  CANCELLED: 'danger',
  RSVP: 'default',
}

const TIME_FIELDS = new Set(['start_time', 'end_time', 'original_start', 'check_in_at'])

export function formatAuditChanges(oldValues, newValues, timezone = 'UTC') {
  const oldObj = oldValues ?? {}
  const newObj = newValues ?? {}
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

  const lines = []
  for (const key of keys) {
    const oldVal = oldObj[key]
    const newVal = newObj[key]
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue

    const label = key.replace(/_/g, ' ')
    if (TIME_FIELDS.has(key)) {
      lines.push(
        `${label}: ${oldVal ? formatDateTime(oldVal, timezone) : '—'} → ${newVal ? formatDateTime(newVal, timezone) : '—'}`,
      )
    } else if (typeof oldVal === 'object' || typeof newVal === 'object') {
      lines.push(`${label}: ${JSON.stringify(oldVal ?? null)} → ${JSON.stringify(newVal ?? null)}`)
    } else {
      lines.push(`${label}: ${oldVal ?? '—'} → ${newVal ?? '—'}`)
    }
  }

  return lines.length > 0 ? lines : null
}

export const AUDIT_ACTION_FILTERS = ['', 'CREATED', 'UPDATED', 'RESCHEDULED', 'CANCELLED', 'RSVP']
