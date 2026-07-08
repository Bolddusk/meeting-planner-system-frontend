import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { getAuditLog } from '@/api/audit'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { AUDIT_ACTION_VARIANT, formatAuditChanges } from '@/utils/auditActions'
import { useAuth } from '@/hooks/useAuth'

export default function AuditHistoryTab({ meetingId }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'

  const [entries, setEntries] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAuditLog({ meetingId, page, limit: 20 })
      setEntries(res.data ?? [])
      setMeta(res.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1 })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId, page])

  useEffect(() => {
    loadAudit()
  }, [loadAudit])

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
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const changes = formatAuditChanges(entry.old_values, entry.new_values, timezone)
              return (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {formatDateTime(entry.created_at, timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{entry.actor?.full_name ?? '—'}</p>
                    <p className="text-xs text-slate-500">{entry.actor?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={AUDIT_ACTION_VARIANT[entry.action] ?? 'default'}>
                      {entry.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {changes ? (
                      <ul className="space-y-1">
                        {changes.map((line) => (
                          <li key={line} className="text-xs">
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
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
    </div>
  )
}
