export function formatDateTime(date, timezone = 'Asia/Karachi') {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(date))
}

export function formatDate(date, timezone = 'Asia/Karachi') {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeZone: timezone,
  }).format(new Date(date))
}
