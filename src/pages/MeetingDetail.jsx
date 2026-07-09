import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Link as LinkIcon,
  Users,
  Building2,
  Calendar,
  User,
  ListOrdered,
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
  RefreshCw,
  Clock,
  ListTodo,
  FileText,
  History,
  LogIn,
  GitBranch,
  Bell,
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
import FollowUpModal from '@/components/meetings/FollowUpModal'
import LineageBanner from '@/components/meetings/LineageBanner'
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
import { getActionItems } from '@/api/actionItems'
import { getMeetingNotes } from '@/api/notes'
import { getAuditLog } from '@/api/audit'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime, formatDate } from '@/utils/formatDate'
import {
  AUDIT_ACTION_VARIANT,
  formatAuditChangesText,
} from '@/utils/auditActions'
import {
  MEETING_STATUS_VARIANT,
  RSVP_STATUS_VARIANT,
  formatRsvpStatus,
  summarizeGuestRsvps,
} from '@/utils/meetingStatus'
import { ACTION_ITEM_STATUS_VARIANT } from '@/utils/actionItemStatus'
import { NOTE_TYPE_VARIANT } from '@/utils/noteTypes'
import { assigneeDisplayName } from '@/utils/assignee'
import { humanReadableRRule, isRecurringMeeting } from '@/utils/rrule'
import {
  canScheduleFollowUp,
  normalizeActionItemsResponse,
  normalizeNotesResponse,
} from '@/utils/lineage'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || ''
}

function summarizeAllRsvps(participants = [], guests = []) {
  const counts = {
    ACCEPTED: 0,
    PENDING: 0,
    DECLINED: 0,
    TENTATIVE: 0,
    RESCHEDULE_REQUESTED: 0,
  }
  for (const p of participants) {
    const key = p.rsvp_status || 'PENDING'
    counts[key] = (counts[key] ?? 0) + 1
  }
  for (const g of guests) {
    const key = g.rsvp_status || 'PENDING'
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

function guestRsvpIcon(status) {
  if (status === 'ACCEPTED') return CheckCircle
  if (status === 'TENTATIVE') return HelpCircle
  if (status === 'DECLINED') return Ban
  if (status === 'RESCHEDULE_REQUESTED') return CalendarClock
  return Clock
}

function guestRsvpIconClass(status) {
  if (status === 'ACCEPTED') return 'text-emerald-600'
  if (status === 'TENTATIVE') return 'text-amber-600'
  if (status === 'DECLINED') return 'text-red-600'
  if (status === 'RESCHEDULE_REQUESTED') return 'text-orange-600'
  return 'text-slate-400'
}

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
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [icsLoading, setIcsLoading] = useState(false)
  const [guestRefreshLoading, setGuestRefreshLoading] = useState(false)
  const [overviewActions, setOverviewActions] = useState([])
  const [overviewNotes, setOverviewNotes] = useState([])
  const [overviewActivity, setOverviewActivity] = useState([])

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

  const loadOverviewWidgets = useCallback(async () => {
    try {
      const requests = [
        getActionItems({ meetingId: id, limit: 10 }),
        getMeetingNotes(id),
      ]
      if (canViewAudit) {
        requests.push(getAuditLog({ meetingId: id, page: 1, limit: 5 }))
      }

      const [actionsRes, notesRes, auditRes] = await Promise.all(requests)
      const actionData = normalizeActionItemsResponse(actionsRes)
      const noteData = normalizeNotesResponse(notesRes)
      const actions = actionData.items.filter((item) =>
        ['OPEN', 'IN_PROGRESS'].includes(item.status),
      )
      setOverviewActions(actions.slice(0, 5))
      setOverviewNotes(noteData.notes.slice(0, 2))
      setOverviewActivity(canViewAudit ? (auditRes?.data ?? []).slice(0, 5) : [])
    } catch {
      setOverviewActions([])
      setOverviewNotes([])
      setOverviewActivity([])
    }
  }, [id, canViewAudit])

  const refreshMeetingQuiet = useCallback(async () => {
    try {
      const res = await getMeeting(id)
      setMeeting(res.data)
    } catch {
      // ignore background refresh errors
    }
  }, [id])

  const handleGuestRefresh = async () => {
    setGuestRefreshLoading(true)
    try {
      await refreshMeetingQuiet()
    } finally {
      setGuestRefreshLoading(false)
    }
  }

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

  useEffect(() => {
    if (!id) return
    loadOverviewWidgets()
  }, [id, activeTab, loadOverviewWidgets])

  const hasPendingGuestRsvps = meeting?.guests?.some(
    (g) => !g.rsvp_status || g.rsvp_status === 'PENDING',
  )

  useEffect(() => {
    if (activeTab !== 'overview' || !hasPendingGuestRsvps) return undefined

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshMeetingQuiet()
      }
    }

    const interval = setInterval(refreshIfVisible, 30_000)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [activeTab, hasPendingGuestRsvps, refreshMeetingQuiet])

  const myParticipation = meeting?.participants?.find((p) => p.user_id === user?.id)
  const canRsvp = can('rsvp.manage') && myParticipation && meeting?.status !== 'CANCELLED'
  const showReschedule =
    canReschedule && meeting?.status !== 'CANCELLED'
  const showRequestReschedule =
    canRequestReschedule && myParticipation && meeting?.status !== 'CANCELLED'
  const showFollowUp = canScheduleFollowUp(meeting, user, can)

  const rsvpTotals = useMemo(
    () => summarizeAllRsvps(meeting?.participants ?? [], meeting?.guests ?? []),
    [meeting?.participants, meeting?.guests],
  )

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
    <div className="min-w-0 max-w-full space-y-6">
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
          {showFollowUp && (
            <Button variant="secondary" size="sm" onClick={() => setFollowUpOpen(true)}>
              <GitBranch className="h-4 w-4" />
              Schedule follow-up
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
        description={meeting.description || undefined}
      />

      {meeting.status === 'SCHEDULED' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-900">
            Participants receive an email and in-app notification 1 hour before this meeting.
          </p>
        </div>
      )}

      {meeting.lineage?.type === 'FOLLOW_UP' && (
        <LineageBanner lineage={meeting.lineage} timezone={timezone} />
      )}

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
            <NotesTab meetingId={id} meeting={meeting} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'action-items' && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Action Items</h3>
          </CardHeader>
          <CardBody>
            <ActionItemsTab meetingId={id} meeting={meeting} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-slate-900">Audit History</h3>
          </CardHeader>
          <CardBody>
            <AuditHistoryTab meetingId={id} meeting={meeting} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Row 1 — Overview (wide) + Your RSVP (narrow) */}
          <div className={cn('grid grid-cols-1 gap-6', canRsvp && 'lg:grid-cols-3')}>
            <Card className={cn('overflow-hidden border-primary-100/80 shadow-md', canRsvp && 'lg:col-span-2')}>
              <CardHeader className="border-b border-primary-100/60 bg-gradient-to-r from-primary-50 via-white to-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">Overview</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Meeting details & schedule</p>
                  </div>
                  <Badge variant={MEETING_STATUS_VARIANT[meeting.status]} className="shrink-0 text-xs font-bold uppercase tracking-wide">
                    {meeting.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardBody className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Start</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatDateTime(meeting.start_time, timezone)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">End</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatDateTime(meeting.end_time, timezone)}
                      </p>
                    </div>
                  </div>
                  {meeting.original_start && (
                    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 sm:col-span-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <CalendarClock className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Original start</p>
                        <p className="mt-0.5 text-sm font-semibold text-amber-900">
                          {formatDateTime(meeting.original_start, timezone)}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Organizer</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {meeting.organizer?.full_name ?? '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Department</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {meeting.department?.name ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {meeting.room && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Location</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {meeting.room.name}
                        <span className="font-medium text-slate-600"> — {meeting.room.location}</span>
                        {meeting.room.is_virtual && (
                          <span className="ml-1 rounded bg-emerald-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                            Virtual
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {meeting.meeting_link && (
                  <div className="flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                      <LinkIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary-700">Meeting link</p>
                      <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 block break-all text-sm font-semibold text-primary-800 hover:text-primary-900 hover:underline"
                      >
                        {meeting.meeting_link}
                      </a>
                    </div>
                  </div>
                )}

                {meeting.agenda?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <ListOrdered className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">Agenda</p>
                    </div>
                    <ol className="space-y-2">
                      {meeting.agenda.map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm font-medium text-slate-800"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <span className="min-w-0 pt-0.5">{item}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardBody>
            </Card>

            {canRsvp && (
              <Card className="overflow-hidden border-primary-100/80 shadow-md lg:col-span-1">
                <CardHeader className="border-b border-primary-100/60 bg-gradient-to-r from-sky-50 via-white to-primary-50/40">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900">Your RSVP</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">Update your attendance</p>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Current status
                      </p>
                      <Badge
                        variant={RSVP_STATUS_VARIANT[myParticipation.rsvp_status]}
                        className="mt-1 text-xs font-bold uppercase tracking-wide"
                      >
                        {formatRsvpStatus(myParticipation.rsvp_status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Respond
                    </p>
                    {[
                      {
                        status: 'ACCEPTED',
                        label: 'Accept',
                        Icon: CheckCircle,
                        activeClass: 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200',
                        iconClass: 'bg-emerald-100 text-emerald-700',
                        textClass: 'text-emerald-900',
                      },
                      {
                        status: 'TENTATIVE',
                        label: 'Tentative',
                        Icon: HelpCircle,
                        activeClass: 'border-amber-300 bg-amber-50 ring-2 ring-amber-200',
                        iconClass: 'bg-amber-100 text-amber-700',
                        textClass: 'text-amber-900',
                      },
                      {
                        status: 'DECLINED',
                        label: 'Decline',
                        Icon: Ban,
                        activeClass: 'border-red-300 bg-red-50 ring-2 ring-red-200',
                        iconClass: 'bg-red-100 text-red-700',
                        textClass: 'text-red-900',
                      },
                    ].map(({ status, label, Icon, activeClass, iconClass, textClass }) => {
                      const isActive = myParticipation.rsvp_status === status
                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleRsvp(status)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left transition-all hover:border-primary-200 hover:bg-primary-50/40 disabled:cursor-not-allowed disabled:opacity-60',
                            isActive && activeClass,
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600',
                              isActive && iconClass,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span
                            className={cn(
                              'text-sm font-semibold text-slate-800',
                              isActive && textClass,
                            )}
                          >
                            {label}
                          </span>
                          {isActive && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Selected
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {!myParticipation.check_in_at ? (
                    <div className="rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3.5">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                          <LogIn className="h-4 w-4" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">Check in</p>
                      </div>
                      <p className="mb-3 text-xs text-slate-600">
                        Mark yourself present when the meeting starts.
                      </p>
                      <Button
                        size="sm"
                        className="w-full font-semibold"
                        loading={actionLoading}
                        onClick={handleCheckIn}
                      >
                        <LogIn className="h-4 w-4" />
                        Check in now
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                          Checked in
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-emerald-900">
                          {formatDateTime(myParticipation.check_in_at, timezone)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>

          {/* Row 2 — Participants + Guests + Quick stats (equal) */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Card className="flex min-h-0 flex-col">
              <CardHeader>
                <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                  <Users className="h-4 w-4" />
                  Participants ({meeting.participants?.length ?? 0})
                </h3>
              </CardHeader>
              <CardBody className="min-h-0 flex-1 p-4">
                {!meeting.participants?.length ? (
                  <p className="text-sm text-slate-500">No participants.</p>
                ) : (
                  <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto pr-1 sm:max-h-72">
                    {meeting.participants.map((p) => (
                      <div
                        key={p.user_id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {p.full_name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {p.role}
                            {p.email ? ` · ${p.email}` : ''}
                          </p>
                        </div>
                        <Badge variant={RSVP_STATUS_VARIANT[p.rsvp_status]}>
                          {formatRsvpStatus(p.rsvp_status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="flex min-h-0 flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                      <Mail className="h-4 w-4" />
                      External guests ({meeting.guests?.length ?? 0})
                    </h3>
                    {meeting.guests?.length > 0 && (() => {
                      const gs = summarizeGuestRsvps(meeting.guests)
                      const parts = [
                        gs.ACCEPTED > 0 && `${gs.ACCEPTED} accepted`,
                        gs.PENDING > 0 && `${gs.PENDING} pending`,
                        gs.RESCHEDULE_REQUESTED > 0 && `${gs.RESCHEDULE_REQUESTED} reschedule`,
                        gs.DECLINED > 0 && `${gs.DECLINED} declined`,
                      ].filter(Boolean)
                      return parts.length ? (
                        <p className="mt-0.5 text-xs text-slate-500">{parts.join(' · ')}</p>
                      ) : null
                    })()}
                  </div>
                  {meeting.guests?.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={guestRefreshLoading}
                      onClick={handleGuestRefresh}
                      title="Refresh guest RSVP"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody className="min-h-0 flex-1 p-4">
                {!meeting.guests?.length ? (
                  <p className="text-sm text-slate-500">No external guests.</p>
                ) : (
                  <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto pr-1 sm:max-h-72">
                    {meeting.guests.map((g) => {
                      const status = g.rsvp_status || 'PENDING'
                      return (
                        <div
                          key={g.id ?? g.email}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {g.email}
                            </p>
                            {g.name && (
                              <p className="truncate text-[11px] text-slate-500">{g.name}</p>
                            )}
                          </div>
                          <Badge variant={RSVP_STATUS_VARIANT[status] ?? 'default'}>
                            {formatRsvpStatus(status)}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Quick stats</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">People</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900">
                      {(meeting.participants?.length ?? 0) + (meeting.guests?.length ?? 0)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {meeting.participants?.length ?? 0} in · {meeting.guests?.length ?? 0} guests
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Accepted</p>
                    <p className="mt-0.5 text-lg font-bold text-emerald-800">{rsvpTotals.ACCEPTED}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-amber-700">Pending</p>
                    <p className="mt-0.5 text-lg font-bold text-amber-800">{rsvpTotals.PENDING}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-red-700">Declined</p>
                    <p className="mt-0.5 text-lg font-bold text-red-800">{rsvpTotals.DECLINED}</p>
                  </div>
                  {(rsvpTotals.TENTATIVE > 0 || rsvpTotals.RESCHEDULE_REQUESTED > 0) && (
                    <>
                      <div className="rounded-lg bg-sky-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-sky-700">Maybe</p>
                        <p className="mt-0.5 text-lg font-bold text-sky-800">{rsvpTotals.TENTATIVE}</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-orange-700">
                          Reschedule
                        </p>
                        <p className="mt-0.5 text-lg font-bold text-orange-800">
                          {rsvpTotals.RESCHEDULE_REQUESTED}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Row 3 — Action items + Notes + Activity (equal) */}
          <div
            className={cn(
              'grid grid-cols-1 gap-6',
              canViewAudit ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
            )}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                    <ListTodo className="h-4 w-4" />
                    Open action items
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('action-items')}
                    className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    View all
                  </button>
                </div>
              </CardHeader>
              <CardBody className={overviewActions.length ? 'p-0' : undefined}>
                {overviewActions.length === 0 ? (
                  <p className="text-sm text-slate-500">No open action items.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overviewActions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 px-6 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                          <p className="truncate text-xs text-slate-500">
                            {assigneeDisplayName(item.assignee)}
                            {item.due_date ? ` · due ${formatDate(item.due_date, timezone)}` : ''}
                          </p>
                        </div>
                        <Badge variant={ACTION_ITEM_STATUS_VARIANT[item.status] ?? 'default'}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                    <FileText className="h-4 w-4" />
                    Recent notes
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('notes')}
                    className="text-xs font-medium text-primary-700 hover:text-primary-800"
                  >
                    View all
                  </button>
                </div>
              </CardHeader>
              <CardBody className={overviewNotes.length ? 'p-0' : undefined}>
                {overviewNotes.length === 0 ? (
                  <p className="text-sm text-slate-500">No notes yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overviewNotes.map((note) => {
                      const preview = stripHtml(note.content)
                      return (
                        <div key={note.id} className="px-6 py-3">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant={NOTE_TYPE_VARIANT[note.note_type] ?? 'default'}>
                              {note.note_type}
                            </Badge>
                            {note.is_private && <Badge variant="default">Private</Badge>}
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-700">{preview || '—'}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {note.author?.full_name}
                            {note.created_at
                              ? ` · ${formatDateTime(note.created_at, timezone)}`
                              : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            {canViewAudit && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                        <History className="h-4 w-4" />
                        Recent Activity
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Last updates for this meeting
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('audit')}
                      className="shrink-0 text-xs font-medium text-primary-700 hover:text-primary-800"
                    >
                      View full history
                    </button>
                  </div>
                </CardHeader>
                <CardBody className={overviewActivity.length ? 'p-0' : undefined}>
                  {overviewActivity.length === 0 ? (
                    <p className="text-sm text-slate-500">No recent activity yet</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {overviewActivity.map((entry) => {
                        const summary =
                          formatAuditChangesText(
                            entry.old_values,
                            entry.new_values,
                            timezone,
                          ).slice(0, 80) || '—'
                        return (
                          <div
                            key={entry.id ?? `${entry.action}-${entry.created_at}`}
                            className="px-6 py-3"
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-slate-400">
                                {formatDateTime(entry.created_at, timezone)}
                              </span>
                              <Badge variant={AUDIT_ACTION_VARIANT[entry.action] ?? 'default'}>
                                {entry.action}
                              </Badge>
                            </div>
                            <p className="truncate text-sm font-medium text-slate-900">
                              {entry.actor?.full_name || 'Unknown'}
                            </p>
                            {entry.actor?.email && (
                              <p className="truncate text-[11px] text-slate-400">
                                {entry.actor.email}
                              </p>
                            )}
                            <p className="mt-1 truncate text-xs text-slate-500">{summary}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      <FollowUpModal
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        meeting={meeting}
        onCreated={(created) => navigate(`/meetings/${created.id}`)}
      />

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
