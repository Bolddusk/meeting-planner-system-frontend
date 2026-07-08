import { CalendarClock, Info, Repeat } from 'lucide-react'
import {
  buildRRule,
  humanReadableRRule,
  DAY_CODES,
  DAY_LABELS,
  DEFAULT_RECURRENCE,
} from '@/utils/rrule'
import { cn } from '@/utils/cn'

function freqUnit(freq, interval) {
  if (freq === 'DAILY') return interval > 1 ? 'days' : 'day'
  if (freq === 'WEEKLY') return interval > 1 ? 'weeks' : 'week'
  return interval > 1 ? 'months' : 'month'
}

function buildFriendlySummary(recurrence) {
  if (!recurrence.enabled) return ''

  const rrule = buildRRule(recurrence)
  const readable = humanReadableRRule(rrule)

  if (recurrence.endType === 'count' && recurrence.count) {
    return `This meeting will repeat ${readable.replace(/ · \d+ occurrence.*$/, '').toLowerCase()}, for a total of ${recurrence.count} meeting${recurrence.count === 1 ? '' : 's'}.`
  }

  if (recurrence.endType === 'until' && recurrence.until) {
    return `This meeting will repeat ${readable.replace(/ · until.*$/, '').toLowerCase()}, until ${recurrence.until}.`
  }

  return `This meeting will repeat ${readable.toLowerCase()}.`
}

export default function RecurrenceBuilder({ value, onChange }) {
  const recurrence = value ?? DEFAULT_RECURRENCE

  const update = (patch) => onChange({ ...recurrence, ...patch })

  const summary = recurrence.enabled ? buildFriendlySummary(recurrence) : ''

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 bg-slate-50 px-4 py-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Recurring meeting</p>
            <p className="mt-0.5 text-sm text-slate-500">
              {recurrence.enabled
                ? 'This meeting will happen more than once on a fixed schedule.'
                : 'One-time meeting only — turn on to repeat weekly, daily, etc.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={recurrence.enabled}
          onClick={() => update({ enabled: !recurrence.enabled })}
          className={cn(
            'relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors',
            recurrence.enabled ? 'bg-primary-700' : 'bg-slate-300',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
              recurrence.enabled && 'translate-x-5',
            )}
          />
        </button>
      </div>

      {recurrence.enabled && (
        <div className="space-y-5 border-t border-slate-200 px-4 py-5">
          <section>
            <p className="mb-2 text-sm font-medium text-slate-800">How often should it repeat?</p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <span>Every</span>
              <input
                type="number"
                min={1}
                max={99}
                value={recurrence.interval}
                onChange={(e) => update({ interval: Number(e.target.value) || 1 })}
                className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-medium"
              />
              <select
                value={recurrence.freq}
                onChange={(e) => update({ freq: e.target.value })}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium"
              >
                <option value="DAILY">{freqUnit('DAILY', recurrence.interval)}</option>
                <option value="WEEKLY">{freqUnit('WEEKLY', recurrence.interval)}</option>
                <option value="MONTHLY">{freqUnit('MONTHLY', recurrence.interval)}</option>
              </select>
            </div>
          </section>

          {recurrence.freq === 'WEEKLY' && (
            <section>
              <p className="mb-1 text-sm font-medium text-slate-800">Which days of the week?</p>
              <p className="mb-3 text-xs text-slate-500">Pick one or more days. Example: Mon + Wed for twice a week.</p>
              <div className="grid grid-cols-7 gap-2">
                {DAY_CODES.map((code) => {
                  const selected = recurrence.byDay?.includes(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        const current = recurrence.byDay ?? []
                        const next = selected
                          ? current.filter((d) => d !== code)
                          : [...current, code]
                        update({ byDay: next.length ? next : [code] })
                      }}
                      className={cn(
                        'rounded-lg border px-1 py-2 text-center text-xs font-semibold transition-colors sm:text-sm',
                        selected
                          ? 'border-primary-600 bg-primary-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <span className="hidden sm:inline">{DAY_LABELS[code].slice(0, 3)}</span>
                      <span className="sm:hidden">{DAY_LABELS[code].slice(0, 1)}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {recurrence.freq === 'MONTHLY' && (
            <section>
              <p className="mb-2 text-sm font-medium text-slate-800">Which day of the month?</p>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>On day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={recurrence.monthDay}
                  onChange={(e) => update({ monthDay: Number(e.target.value) || 1 })}
                  className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center"
                />
                <span>of each month</span>
              </div>
            </section>
          )}

          <section>
            <p className="mb-3 text-sm font-medium text-slate-800">When should the series end?</p>
            <div className="space-y-2">
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  recurrence.endType === 'count'
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  className="mt-1"
                  checked={recurrence.endType === 'count'}
                  onChange={() => update({ endType: 'count' })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">After a number of meetings</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <span>Stop after</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={recurrence.count}
                      disabled={recurrence.endType !== 'count'}
                      onChange={(e) => update({ count: Number(e.target.value) || 1 })}
                      className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center disabled:bg-slate-100"
                    />
                    <span>meetings</span>
                  </div>
                </div>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  recurrence.endType === 'until'
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <input
                  type="radio"
                  className="mt-1"
                  checked={recurrence.endType === 'until'}
                  onChange={() => update({ endType: 'until' })}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">On a specific date</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <span>End on</span>
                    <input
                      type="date"
                      value={recurrence.until}
                      disabled={recurrence.endType !== 'until'}
                      onChange={(e) => update({ until: e.target.value })}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </label>
            </div>
          </section>

          {summary && (
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  In simple words
                </p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-900">{summary}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Tip: Weekly + 12 meetings = about 3 months of standups. You can cancel the series
              later from the meetings list.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
