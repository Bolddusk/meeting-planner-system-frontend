import { useCallback, useEffect, useState } from 'react'
import Badge from '@/components/ui/Badge'
import { getMyRescheduleRequest, getRescheduleRequests } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { isMeetingOrganizer } from '@/utils/lineage'
import { isAdminOrAbove } from '@/utils/permissions'
import { useAuth } from '@/hooks/useAuth'

const STATUS_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
}

const STATUS_LABEL = {
  PENDING: 'Reschedule requested',
  APPROVED: 'Reschedule approved',
  REJECTED: 'Reschedule declined',
  CANCELLED: 'Request cancelled',
}

export default function RescheduleRequestsPanel({ meetingId, meeting, refreshKey = 0 }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'
  const isOrganizer = isMeetingOrganizer(meeting, user) || isAdminOrAbove(user)

  const [myRequest, setMyRequest] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (isOrganizer) {
        const res = await getRescheduleRequests(meetingId)
        setRequests(Array.isArray(res.data) ? res.data : [])
      } else {
        const res = await getMyRescheduleRequest(meetingId)
        setMyRequest(res.data?.request ?? null)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [isOrganizer, meetingId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
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

  if (isOrganizer) {
    if (!requests.length) return null

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900">Reschedule requests</h4>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Proposed time</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{req.requester?.full_name}</p>
                    <p className="text-xs text-slate-500">{req.requester?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[req.status] ?? 'default'}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {req.proposed_start_time
                      ? formatDateTime(req.proposed_start_time, timezone)
                      : '—'}
                    {req.proposed_end_time && (
                      <span className="block text-xs text-slate-400">
                        to {formatDateTime(req.proposed_end_time, timezone)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{req.message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requests.some((r) => r.status === 'PENDING') && (
          <p className="text-xs text-amber-700">
            Use Reschedule on this meeting to approve a pending request.
          </p>
        )}
      </div>
    )
  }

  if (!myRequest) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <Badge variant={STATUS_VARIANT[myRequest.status] ?? 'default'}>
        {STATUS_LABEL[myRequest.status] ?? myRequest.status}
      </Badge>
      <div className="min-w-0 text-sm text-amber-900">
        <p className="font-medium">Your reschedule request</p>
        {myRequest.message && <p className="mt-1">{myRequest.message}</p>}
        {myRequest.proposed_start_time && (
          <p className="mt-1 text-xs text-amber-800">
            Proposed: {formatDateTime(myRequest.proposed_start_time, timezone)}
            {myRequest.proposed_end_time
              ? ` – ${formatDateTime(myRequest.proposed_end_time, timezone)}`
              : ''}
          </p>
        )}
      </div>
    </div>
  )
}
