import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Link as LinkIcon,
  Users,
  Pencil,
  XCircle,
  CheckCircle,
  HelpCircle,
  Ban,
  Repeat,
  CalendarClock,
  MessageSquare,
  Download,
  Mail,
} from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import MeetingFormModal from '@/components/meetings/MeetingFormModal'
import RecurrenceScopeModal from '@/components/meetings/RecurrenceScopeModal'
import RescheduleModal from '@/components/meetings/RescheduleModal'
import RequestRescheduleModal from '@/components/meetings/RequestRescheduleModal'
import AuditHistoryTab from '@/components/meetings/AuditHistoryTab'
import NotesTab from '@/components/meetings/NotesTab'
import ActionItemsTab from '@/components/meetings/ActionItemsTab'
import {
  getMeeting,
  cancelMeetingScope,
  rsvpMeeting,
  checkInMeeting,
  downloadMeetingIcs,
} from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime, formatDate } from '@/utils/formatDate'
import { MEETING_STATUS_VARIANT, RSVP_STATUS_VARIANT } from '@/utils/meetingStatus'
import { humanReadableRRule, isRecurringMeeting } from '@/utils/rrule'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

export default function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [requestRescheduleOpen, setRequestRescheduleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [scopeCancelOpen, setScopeCancelOpen] = useState(false)
  const [icsLoading, setIcsLoading] = useState(false)

  const canReschedule = can('meeting.reschedule')
  const canRequestReschedule = can('reschedule.request') && !canReschedule
  const canViewAudit = can('audit.view')

  const loadMeeting = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMeeting(id)
      setMeeting(res.data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

  const myParticipation = meeting?.participants?.find((p) => p.user_id === user?.id)
  const canRsvp = can('rsvp.manage') && myParticipation && meeting?.status !== 'CANCELLED'
  const showReschedule =
    canReschedule && meeting?.status !== 'CANCELLED'
  const showRequestReschedule =
    canRequestReschedule && myParticipation && meeting?.status !== 'CANCELLED'

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes' },
    { id: 'action-items', label: 'Action Items' },
    ...(canViewAudit ? [{ id: 'audit', label: 'Audit History' }] : []),
  ]

  const handleRsvp = async (status) => {
    setActionLoading(true)
    try {
      await rsvpMeeting(id, status)
      await loadMeeting()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckIn = async () => {
    setActionLoading(true)
    try {
      await checkInMeeting(id)
      await loadMeeting()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    try {
      await cancelMeetingScope(id)
      setCancelOpen(false)
      await loadMeeting()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleScopeCancel = async (scope) => {
    setActionLoading(true)
    try {
      await cancelMeetingScope(id, scope)
      setScopeCancelOpen(false)
      if (scope === 'this') {
        navigate('/meetings')
      } else {
        await loadMeeting()
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const openCancel = () => {
    if (isRecurringMeeting(meeting)) {
      setScopeCancelOpen(true)
    } else {
      setCancelOpen(true)
    }
  }

  const handleDownloadIcs = async () => {
    setIcsLoading(true)
    setError('')
    try {
      await downloadMeetingIcs(id)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIcsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  if (error && !meeting) {
    return (
      <div className="space-y-4">
        <Link to="/meetings" className="inline-flex items-center gap-2 text-sm text-primary-700">
          <ArrowLeft className="h-4 w-4" />
          Back to meetings
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/meetings" className="inline-flex items-center gap-2 text-sm text-primary-700">
          <ArrowLeft className="h-4 w-4" />
          Back to meetings
        </Link>
        <div className="flex flex-wrap gap-2">
          {showReschedule && (
            <Button variant="secondary" size="sm" onClick={() => setRescheduleOpen(true)}>
              <CalendarClock className="h-4 w-4" />
              Reschedule
            </Button>
          )}
          {showRequestReschedule && (
            <Button variant="secondary" size="sm" onClick={() => setRequestRescheduleOpen(true)}>
              <MessageSquare className="h-4 w-4" />
              Request reschedule
            </Button>
          )}
          {can('meeting.edit') && meeting.status !== 'CANCELLED' && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {can('export.ics') && (
            <Button variant="secondary" size="sm" onClick={handleDownloadIcs} loading={icsLoading}>
              <Download className="h-4 w-4" />
              Download ICS
            </Button>
          )}
          {can('meeting.cancel') && meeting.status !== 'CANCELLED' && (
            <Button variant="danger" size="sm" onClick={openCancel}>
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <PageHero
        eyebrow="MEETING DETAIL"
        title={meeting.title}
        description={meeting.description || 'No description provided.'}
      />

      {isRecurringMeeting(meeting) && meeting.recurrence?.rrule && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="primary">RECURRING</Badge>
            <div className="flex items-center gap-2 text-sm text-primary-900">
              <Repeat className="h-4 w-4" />
              <span>{humanReadableRRule(meeting.recurrence.rrule)}</span>
            </div>
          </div>
          <p className="mt-2 font-mono text-xs text-primary-700">{meeting.recurrence.rrule}</p>
          {meeting.recurrence.exceptions?.length > 0 && (
            <div className="mt-3 border-t border-primary-200 pt-3">
              <p className="text-xs font-medium uppercase text-primary-800">Exceptions</p>
              <ul className="mt-1 space-y-1">
                {meeting.recurrence.exceptions.map((ex) => (
                  <li key={ex} className="text-sm text-primary-900">
                    {formatDate(ex, timezone)} (cancelled)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary-700 text-primary-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Meeting Notes</h3>
          </CardHeader>
          <CardBody>
            <NotesTab meetingId={id} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'action-items' && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Action Items</h3>
          </CardHeader>
          <CardBody>
            <ActionItemsTab meetingId={id} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Audit History</h3>
          </CardHeader>
          <CardBody>
            <AuditHistoryTab meetingId={id} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Overview</h3>
                <Badge variant={MEETING_STATUS_VARIANT[meeting.status]}>{meeting.status}</Badge>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Start</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatDateTime(meeting.start_time, timezone)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">End</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatDateTime(meeting.end_time, timezone)}
                  </p>
                </div>
                {meeting.original_start && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase text-slate-500">Original start</p>
                    <p className="mt-1 text-sm text-amber-800">
                      {formatDateTime(meeting.original_start, timezone)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Organizer</p>
                  <p className="mt-1 text-sm text-slate-900">{meeting.organizer?.full_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Department</p>
                  <p className="mt-1 text-sm text-slate-900">{meeting.department?.name ?? '—'}</p>
                </div>
              </div>

              {meeting.room && (
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    {meeting.room.name} — {meeting.room.location}
                    {meeting.room.is_virtual && ' (Virtual)'}
                  </span>
                </div>
              )}

              {meeting.meeting_link && (
                <div className="flex items-start gap-2 text-sm">
                  <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-700 hover:underline"
                  >
                    {meeting.meeting_link}
                  </a>
                </div>
              )}

              {meeting.agenda?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-slate-500">Agenda</p>
                  <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
                    {meeting.agenda.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-6">
            {canRsvp && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-slate-900">Your RSVP</h3>
                </CardHeader>
                <CardBody className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Current status:{' '}
                    <Badge variant={RSVP_STATUS_VARIANT[myParticipation.rsvp_status]}>
                      {myParticipation.rsvp_status}
                    </Badge>
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={actionLoading}
                      onClick={() => handleRsvp('ACCEPTED')}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={actionLoading}
                      onClick={() => handleRsvp('TENTATIVE')}
                    >
                      <HelpCircle className="h-4 w-4" />
                      Tentative
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={actionLoading}
                      onClick={() => handleRsvp('DECLINED')}
                    >
                      <Ban className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                  {!myParticipation.check_in_at && (
                    <Button size="sm" loading={actionLoading} onClick={handleCheckIn}>
                      Check in
                    </Button>
                  )}
                  {myParticipation.check_in_at && (
                    <p className="text-xs text-emerald-700">
                      Checked in at {formatDateTime(myParticipation.check_in_at, timezone)}
                    </p>
                  )}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                  <Users className="h-4 w-4" />
                  Participants ({meeting.participants?.length ?? 0})
                </h3>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-slate-100">
                  {meeting.participants?.map((p) => (
                    <div key={p.user_id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{p.full_name}</p>
                        <p className="text-xs text-slate-500">{p.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">{p.role}</span>
                        <Badge variant={RSVP_STATUS_VARIANT[p.rsvp_status]}>{p.rsvp_status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            {meeting.guests?.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                    <Mail className="h-4 w-4" />
                    External guests ({meeting.guests.length})
                  </h3>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-slate-100">
                    {meeting.guests.map((g) => (
                      <div key={g.id ?? g.email} className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{g.name || g.email}</p>
                          {g.name && <p className="text-xs text-slate-500">{g.email}</p>}
                        </div>
                        <Badge variant={RSVP_STATUS_VARIANT[g.rsvp_status] ?? 'default'}>
                          {g.rsvp_status ?? 'PENDING'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      <MeetingFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        meeting={meeting}
        onSaved={() => {
          setEditOpen(false)
          loadMeeting()
        }}
      />

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        meeting={meeting}
        onRescheduled={loadMeeting}
      />

      <RequestRescheduleModal
        open={requestRescheduleOpen}
        onClose={() => setRequestRescheduleOpen(false)}
        meeting={meeting}
      />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel meeting"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep meeting
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
              Cancel meeting
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to cancel this meeting?</p>
      </Modal>

      <RecurrenceScopeModal
        open={scopeCancelOpen}
        action="cancel"
        onConfirm={handleScopeCancel}
        onClose={() => setScopeCancelOpen(false)}
        loading={actionLoading}
      />
    </div>
  )
}
