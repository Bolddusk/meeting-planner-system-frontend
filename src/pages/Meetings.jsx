import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, XCircle } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import MeetingFormModal from '@/components/meetings/MeetingFormModal'
import RecurrenceScopeModal from '@/components/meetings/RecurrenceScopeModal'
import Modal from '@/components/ui/Modal'
import { getMeetings, cancelMeetingScope } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { dateInputToUtcEnd, dateInputToUtcStart } from '@/utils/datetime'
import { MEETING_STATUS_VARIANT } from '@/utils/meetingStatus'
import { isRecurringMeeting } from '@/utils/rrule'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { isUserRole } from '@/utils/permissions'

const STATUS_FILTERS = ['', 'SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
const PAGE_SIZE = 20
const FETCH_LIMIT = 100 // backend max per request

function sortByNewest(meetings) {
  return [...meetings].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime()
    const bTime = new Date(b.created_at || 0).getTime()
    if (bTime !== aTime) return bTime - aTime
    return (b.id ?? 0) - (a.id ?? 0)
  })
}

export default function Meetings() {
  const { user } = useAuth()
  const { can } = usePermission()
  const isUser = isUserRole(user)
  const timezone = user?.timezone || 'UTC'

  const [meetings, setMeetings] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [scopeCancelOpen, setScopeCancelOpen] = useState(false)

  const loadMeetings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        view: 'list',
        page: 1,
        limit: FETCH_LIMIT,
      }
      if (statusFilter) params.status = statusFilter
      if (fromDate) params.from = dateInputToUtcStart(fromDate, timezone)
      if (toDate) params.to = dateInputToUtcEnd(toDate, timezone)
      if (search) params.search = search

      const res = await getMeetings(params)
      const sorted = sortByNewest(res.data ?? [])
      setMeetings(sorted)
      setMeta({
        page: 1,
        limit: FETCH_LIMIT,
        total: res.meta?.total ?? sorted.length,
        totalPages: 1,
      })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, fromDate, toDate, timezone, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  const displayMeetings = meetings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const displayMeta = {
    page,
    limit: PAGE_SIZE,
    total: meta.total ?? meetings.length,
    totalPages: Math.max(1, Math.ceil((meta.total ?? meetings.length) / PAGE_SIZE)),
  }

  const openCreate = () => {
    setEditingMeeting(null)
    setFormOpen(true)
  }

  const openEdit = (meeting) => {
    setEditingMeeting(meeting)
    setFormOpen(true)
  }

  const openCancel = (meeting) => {
    setCancelTarget(meeting)
    if (isRecurringMeeting(meeting)) {
      setScopeCancelOpen(true)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelMeetingScope(cancelTarget.id)
      setCancelTarget(null)
      await loadMeetings()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setCancelling(false)
    }
  }

  const handleScopeCancel = async (scope) => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await cancelMeetingScope(cancelTarget.id, scope)
      setScopeCancelOpen(false)
      setCancelTarget(null)
      await loadMeetings()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="MEETINGS"
        title={isUser ? 'My Meetings' : 'All Meetings'}
        description={
          isUser
            ? 'Meetings you are invited to as a participant.'
            : 'View, filter, and manage meetings across all departments.'
        }
      />

      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isUser
                    ? 'Search your meetings by title, organizer, or room...'
                    : 'Search title, organizer, room (all meetings)...'
                }
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            {can('meeting.create') && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New Meeting
              </Button>
            )}
          </div>

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
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s || 'all'}
                  type="button"
                  onClick={() => {
                    setStatusFilter(s)
                    setPage(1)
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-primary-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s || 'All'}
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
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">End</th>
                      <th className="px-4 py-3">Organizer</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Participants</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayMeetings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          {search
                            ? 'No meetings match your search.'
                            : 'No meetings found'}
                        </td>
                      </tr>
                    ) : (
                      displayMeetings.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {isRecurringMeeting(m) && (
                              <span className="mr-1" title="Recurring">
                                🔁
                              </span>
                            )}
                            {m.title}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDateTime(m.start_time, timezone)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDateTime(m.end_time, timezone)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {m.organizer?.full_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{m.room?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {m.participant_count ?? m.participants?.length ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={MEETING_STATUS_VARIANT[m.status]}>{m.status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Link
                                to={`/meetings/${m.id}`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              {can('meeting.edit') && m.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => openEdit(m)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {can('meeting.cancel') && m.status !== 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => openCancel(m)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                  title="Cancel"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {displayMeta.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {displayMeta.page} of {displayMeta.totalPages} ({displayMeta.total} total)
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
                      disabled={page >= displayMeta.totalPages}
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

      <MeetingFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        meeting={editingMeeting}
        onSaved={loadMeetings}
      />

      <Modal
        open={Boolean(cancelTarget) && !isRecurringMeeting(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel meeting"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>
              Keep meeting
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              Cancel meeting
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to cancel <strong>{cancelTarget?.title}</strong>? This action
          cannot be undone.
        </p>
      </Modal>

      <RecurrenceScopeModal
        open={scopeCancelOpen}
        action="cancel"
        onConfirm={handleScopeCancel}
        onClose={() => {
          setScopeCancelOpen(false)
          setCancelTarget(null)
        }}
        loading={cancelling}
      />
    </div>
  )
}
