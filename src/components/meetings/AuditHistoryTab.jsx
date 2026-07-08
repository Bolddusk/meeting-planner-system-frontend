import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '@/components/ui/Badge'
import ExportToolbar from '@/components/ui/ExportToolbar'
import { getAuditLog } from '@/api/audit'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import {
  AUDIT_ACTION_VARIANT,
  AUDIT_TABLE_CLASS,
  AUDIT_CHANGES_CELL_CLASS,
  AUDIT_CHANGES_LINE_CLASS,
  formatAuditChanges,
  formatAuditChangesText,
} from '@/utils/auditActions'
import { useAuth } from '@/hooks/useAuth'

export default function AuditHistoryTab({ meetingId, meeting }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAuditLog({ meetingId, page: 1, limit: 100 })
      setEntries(res.data ?? [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

  const exportSubtitle = useMemo(() => {
    if (!meeting) return undefined
    return `${meeting.title} · ${formatDateTime(meeting.start_time, timezone)}`
  }, [meeting, timezone])

  const exportRows = useMemo(
    () =>
      entries.map((entry) => [
        formatDateTime(entry.created_at, timezone),
        entry.actor?.full_name || '',
        entry.actor?.email || '',
        entry.action,
        formatAuditChangesText(entry.old_values, entry.new_values, timezone),
      ]),
    [entries, timezone],
  )

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">No audit history for this meeting.</p>
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <div className="flex justify-end">
        <ExportToolbar
          title="Audit History"
          subtitle={exportSubtitle}
          filename={`meeting-${meetingId}-audit-history`}
          headers={['When', 'Actor', 'Email', 'Action', 'Changes']}
          rows={exportRows}
        />
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
        <table className={AUDIT_TABLE_CLASS}>
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-36 px-4 py-3">When</th>
              <th className="w-40 px-4 py-3">Actor</th>
              <th className="w-28 px-4 py-3">Action</th>
              <th className="px-4 py-3">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const changes = formatAuditChanges(entry.old_values, entry.new_values, timezone)
              return (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap align-top">
                    {formatDateTime(entry.created_at, timezone)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="break-words font-medium text-slate-900">
                      {entry.actor?.full_name ?? '—'}
                    </p>
                    <p className="break-all text-xs text-slate-500">{entry.actor?.email}</p>
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
    </div>
  )
}
