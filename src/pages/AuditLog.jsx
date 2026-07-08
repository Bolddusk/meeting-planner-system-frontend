import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { getAuditLog } from '@/api/audit'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { dateInputToUtcEnd, dateInputToUtcStart } from '@/utils/datetime'
import { AUDIT_ACTION_VARIANT, AUDIT_ACTION_FILTERS, formatAuditChanges, AUDIT_TABLE_CLASS, AUDIT_CHANGES_CELL_CLASS, AUDIT_CHANGES_LINE_CLASS } from '@/utils/auditActions'
import { useAuth } from '@/hooks/useAuth'

export default function AuditLog() {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'

  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, limit: 20 }
      if (fromDate) params.from = dateInputToUtcStart(fromDate, timezone)
      if (toDate) params.to = dateInputToUtcEnd(toDate, timezone)
      if (meetingId) params.meetingId = Number(meetingId)
      if (actionFilter) params.action = actionFilter

      const res = await getAuditLog(params)
      setEntries(res.data ?? [])
      setMeta(res.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1 })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, fromDate, toDate, meetingId, actionFilter, timezone])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHero
        eyebrow="ADMINISTRATION"
        title="Audit Log"
        description="System audit trail — actor, action, and change history for meetings."
      />

      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                From date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                To date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value)
                  setPage(1)
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-slate-500">
                Meeting ID
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={meetingId}
                onChange={(e) => {
                  setMeetingId(e.target.value)
                  setPage(1)
                }}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {AUDIT_ACTION_FILTERS.map((a) => (
                <button
                  key={a || 'all'}
                  type="button"
                  onClick={() => {
                    setActionFilter(a)
                    setPage(1)
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    actionFilter === a
                      ? 'bg-primary-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {a || 'All'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No audit entries found.</p>
          ) : (
            <>
              <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
                <table className={AUDIT_TABLE_CLASS}>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-36 px-4 py-3">When</th>
                      <th className="w-40 px-4 py-3">Actor</th>
                      <th className="w-36 px-4 py-3">Meeting</th>
                      <th className="w-28 px-4 py-3">Action</th>
                      <th className="px-4 py-3">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => {
                      const changes = formatAuditChanges(
                        entry.old_values,
                        entry.new_values,
                        timezone,
                      )
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600 align-top">
                            {formatDateTime(entry.created_at, timezone)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="break-words font-medium text-slate-900">
                              {entry.actor?.full_name ?? '—'}
                            </p>
                            <p className="break-all text-xs text-slate-500">{entry.actor?.email}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            {entry.meeting_id ? (
                              <Link
                                to={`/meetings/${entry.meeting_id}`}
                                className="break-words text-primary-700 hover:underline"
                              >
                                {entry.meeting?.title ?? `#${entry.meeting_id}`}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge variant={AUDIT_ACTION_VARIANT[entry.action] ?? 'default'}>
                              {entry.action}
                            </Badge>
                          </td>
                          <td className={`px-4 py-3 align-top ${AUDIT_CHANGES_CELL_CLASS}`}>
                            {changes ? (
                              <ul className="space-y-1">
                                {changes.map((line) => (
                                  <li key={line} className={AUDIT_CHANGES_LINE_CLASS}>
                                    {line}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {meta.page} of {meta.totalPages} ({meta.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
