const DAY_LABELS = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
}

const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

export const DEFAULT_RECURRENCE = {
  enabled: false,
  freq: 'WEEKLY',
  interval: 1,
  byDay: ['MO'],
  monthDay: 1,
  endType: 'count',
  count: 12,
  until: '',
}

export function parseRRule(rrule) {
  if (!rrule) return { ...DEFAULT_RECURRENCE, enabled: false }

  const parts = Object.fromEntries(
    rrule.split(';').map((segment) => {
      const [key, ...rest] = segment.split('=')
      return [key, rest.join('=')]
    }),
  )

  return {
    enabled: true,
    freq: parts.FREQ || 'WEEKLY',
    interval: Number.parseInt(parts.INTERVAL || '1', 10),
    byDay: parts.BYDAY ? parts.BYDAY.split(',') : [],
    monthDay: Number.parseInt(parts.BYMONTHDAY || '1', 10),
    endType: parts.UNTIL ? 'until' : 'count',
    count: parts.COUNT ? Number.parseInt(parts.COUNT, 10) : 12,
    until: parts.UNTIL ? parseUntil(parts.UNTIL) : '',
  }
}

function parseUntil(until) {
  if (until.length >= 8) {
    const y = until.slice(0, 4)
    const m = until.slice(4, 6)
    const d = until.slice(6, 8)
    return `${y}-${m}-${d}`
  }
  return ''
}

export function formatUntil(dateValue) {
  if (!dateValue) return ''
  const [year, month, day] = dateValue.split('-').map(Number)
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}${pad(month)}${pad(day)}T235959Z`
}

export function buildRRule({ freq, interval, byDay, monthDay, endType, count, until }) {
  let rrule = `FREQ=${freq}`
  if (interval > 1) rrule += `;INTERVAL=${interval}`
  if (freq === 'WEEKLY' && byDay?.length) rrule += `;BYDAY=${byDay.join(',')}`
  if (freq === 'MONTHLY' && monthDay) rrule += `;BYMONTHDAY=${monthDay}`
  if (endType === 'count' && count) rrule += `;COUNT=${count}`
  if (endType === 'until' && until) rrule += `;UNTIL=${formatUntil(until)}`
  return rrule
}

export function humanReadableRRule(rrule) {
  if (!rrule) return ''
  const { freq, interval, byDay, monthDay, endType, count, until } = parseRRule(rrule)

  let text = 'Every '
  if (interval > 1) text += `${interval} `

  if (freq === 'DAILY') {
    text += interval > 1 ? 'days' : 'day'
  } else if (freq === 'WEEKLY') {
    text += interval > 1 ? 'weeks' : 'week'
    if (byDay.length) {
      text += ` on ${byDay.map((d) => DAY_LABELS[d] || d).join(', ')}`
    }
  } else if (freq === 'MONTHLY') {
    text += interval > 1 ? 'months' : 'month'
    if (monthDay) text += ` on day ${monthDay}`
  }

  if (endType === 'count' && count) text += ` · ${count} occurrence${count === 1 ? '' : 's'}`
  if (endType === 'until' && until) text += ` · until ${until}`

  return text
}

export function getDayCodeFromDate(isoOrLocal, timeZone = 'UTC') {
  const date = new Date(isoOrLocal)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  const map = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' }
  return map[weekday] || 'MO'
}

export function getMonthDayFromDate(isoOrLocal, timeZone = 'UTC') {
  const date = new Date(isoOrLocal)
  const day = new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(date)
  return Number.parseInt(day, 10)
}

export function isRecurringMeeting(meeting) {
  return Boolean(meeting?.is_recurring || meeting?.recurrence_id || meeting?.parent_meeting_id)
}

export { DAY_CODES, DAY_LABELS }
