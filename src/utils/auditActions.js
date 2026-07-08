import { formatDateTime } from '@/utils/formatDate'

export const AUDIT_ACTION_VARIANT = {
  CREATED: 'success',
  UPDATED: 'info',
  RESCHEDULED: 'warning',
  CANCELLED: 'danger',
  RSVP: 'default',
}

const TIME_FIELDS = new Set(['start_time', 'end_time', 'original_start', 'check_in_at'])

function stripHtml(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function formatAuditValue(value, key, timezone) {
  if (value == null || value === '') return '—'
  if (TIME_FIELDS.has(key)) return formatDateTime(value, timezone)
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string') {
    const cleaned = stripHtml(value)
    return cleaned || '—'
  }
  return String(value)
}

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
    lines.push(
      `${label}: ${formatAuditValue(oldVal, key, timezone)} → ${formatAuditValue(newVal, key, timezone)}`,
    )
  }

  return lines.length > 0 ? lines : null
}

export function formatAuditChangesText(oldValues, newValues, timezone = 'UTC') {
  const lines = formatAuditChanges(oldValues, newValues, timezone)
  return lines ? lines.join('; ') : ''
}

export const AUDIT_ACTION_FILTERS = ['', 'CREATED', 'UPDATED', 'RESCHEDULED', 'CANCELLED', 'RSVP']

export const AUDIT_TABLE_CLASS = 'w-full table-fixed text-left text-sm'

export const AUDIT_CHANGES_CELL_CLASS =
  'min-w-0 break-words [overflow-wrap:anywhere] text-slate-600'

export const AUDIT_CHANGES_LINE_CLASS = 'break-words [overflow-wrap:anywhere] text-xs'
