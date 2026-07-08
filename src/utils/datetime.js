export function toLocalDatetimeInput(isoUtc, timeZone = 'UTC') {
  if (!isoUtc) return ''
  const date = new Date(isoUtc)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function localDatetimeToUtc(localValue, timeZone = 'UTC') {
  if (!localValue) return null
  const [datePart, timePart] = localValue.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const asUtc = new Date(utcGuess.toLocaleString('en-US', { timeZone: 'UTC' }))
  const asTz = new Date(utcGuess.toLocaleString('en-US', { timeZone }))
  const offset = asUtc.getTime() - asTz.getTime()
  return new Date(utcGuess.getTime() + offset).toISOString()
}

export function toDateInput(isoUtc, timeZone = 'UTC') {
  if (!isoUtc) return ''
  const date = new Date(isoUtc)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function dateInputToUtcStart(dateValue, timeZone = 'UTC') {
  return localDatetimeToUtc(`${dateValue}T00:00`, timeZone)
}

export function dateInputToUtcEnd(dateValue, timeZone = 'UTC') {
  return localDatetimeToUtc(`${dateValue}T23:59`, timeZone)
}
