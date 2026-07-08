import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Clock,
  Plus,
  UserCog,
  ListTodo,
  BarChart3,
  Users,
  DoorOpen,
} from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import InfoBanner from '@/components/ui/InfoBanner'
import StatCard from '@/components/ui/StatCard'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { isAdminOrAbove } from '@/utils/permissions'
import { formatDateTime, formatDate } from '@/utils/formatDate'
import { dateInputToUtcEnd, dateInputToUtcStart } from '@/utils/datetime'
import { getMeetings } from '@/api/meetings'
import { getActionItems } from '@/api/actionItems'
import { getReportSummary } from '@/api/reports'
import { getApiErrorMessage } from '@/api/axios'
import { MEETING_STATUS_VARIANT } from '@/utils/meetingStatus'
import { ACTION_ITEM_STATUS_VARIANT } from '@/utils/actionItemStatus'

function getCurrentMonthRange(timezone) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  const start = `${year}-${month}-01`
  const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  return {
    from: dateInputToUtcStart(start, timezone),
    to: dateInputToUtcEnd(end, timezone),
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const { can } = usePermission()
  const showAdminStats = isAdminOrAbove(user)
  const showReportStats = can('export.report')
  const timezone = user?.timezone || 'UTC'

  const [upcoming, setUpcoming] = useState([])
  const [openItems, setOpenItems] = useState([])
  const [openItemsTotal, setOpenItemsTotal] = useState(0)
  const [reportSummary, setReportSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const now = new Date()
        const weekLater = new Date(now)
        weekLater.setDate(weekLater.getDate() + 7)

        const from = now.toISOString()
        const to = weekLater.toISOString()

        const requests = [
          getMeetings({
            view: 'list',
            from,
            to,
            limit: 5,
            sort: 'start_time',
            order: 'asc',
            status: 'SCHEDULED',
          }),
          getActionItems({
            assigneeId: user?.id,
            status: 'OPEN',
            limit: 5,
          }),
        ]
        if (showReportStats) {
          requests.push(getReportSummary(getCurrentMonthRange(timezone)))
        }

        const results = await Promise.all(requests)
        const meetingsRes = results[0]
        const itemsRes = results[1]

        setUpcoming(meetingsRes.data ?? [])
        setOpenItems(itemsRes.data ?? [])
        setOpenItemsTotal(itemsRes.meta?.total ?? itemsRes.data?.length ?? 0)
        if (showReportStats) {
          setReportSummary(results[2]?.data ?? null)
        }
      } catch (err) {
        setError(getApiErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    if (user?.id) load()
  }, [user?.id, showReportStats, timezone])

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow={`${user?.role?.name?.toUpperCase()} DASHBOARD`}
        title="Dashboard"
        description="Overview of upcoming meetings, open action items, and quick actions."
      />

      <InfoBanner>
        Welcome back, <strong>{user?.full_name}</strong>.
      </InfoBanner>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showReportStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Meetings (month)"
            value={loading ? '—' : (reportSummary?.meetings?.total ?? 0)}
            icon={BarChart3}
            iconClassName="bg-primary-100 text-primary-700"
            loading={loading}
          />
          <StatCard
            label="Attendance Rate"
            value={loading ? '—' : `${reportSummary?.attendance?.rate ?? 0}%`}
            icon={Users}
            iconClassName="bg-sky-100 text-sky-700"
            loading={loading}
          />
          <StatCard
            label="Open Action Items"
            value={loading ? '—' : (reportSummary?.action_items?.open ?? 0)}
            icon={ListTodo}
            iconClassName="bg-amber-100 text-amber-700"
            loading={loading}
          />
          <StatCard
            label="Room Utilization"
            value={loading ? '—' : `${reportSummary?.room_utilization_percent ?? 0}%`}
            icon={DoorOpen}
            iconClassName="bg-violet-100 text-violet-700"
            loading={loading}
          />
        </div>
      )}

      {showAdminStats && !showReportStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Upcoming (7 days)"
            value={loading ? '—' : upcoming.length}
            icon={CalendarDays}
            iconClassName="bg-primary-100 text-primary-700"
            loading={loading}
          />
          <StatCard
            label="Open Action Items"
            value={loading ? '—' : openItemsTotal}
            icon={Clock}
            iconClassName="bg-amber-100 text-amber-700"
            loading={loading}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Upcoming Meetings</h3>
              <p className="text-sm text-slate-500">Next 7 days</p>
            </div>
            <Link to="/meetings">
              <Button variant="secondary" size="sm">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-slate-500">No upcoming meetings</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcoming.map((meeting) => (
                  <Link
                    key={meeting.id}
                    to={`/meetings/${meeting.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{meeting.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {formatDateTime(meeting.start_time, timezone)}
                        {meeting.room?.name ? ` · ${meeting.room.name}` : ''}
                      </p>
                    </div>
                    <Badge variant={MEETING_STATUS_VARIANT[meeting.status]}>{meeting.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">My Open Action Items</h3>
                <p className="text-sm text-slate-500">Assigned to you</p>
              </div>
              <ListTodo className="h-5 w-5 text-slate-400" />
            </CardHeader>
            <CardBody className="p-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
                </div>
              ) : openItems.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-slate-500">No open action items</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {openItems.map((item) => (
                    <Link
                      key={item.id}
                      to={`/meetings/${item.meeting_id}`}
                      className="block px-6 py-3 hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">
                          {item.meeting?.title ?? `Meeting #${item.meeting_id}`}
                          {item.due_date ? ` · due ${formatDate(item.due_date, timezone)}` : ''}
                        </span>
                        <Badge variant={ACTION_ITEM_STATUS_VARIANT[item.status]}>{item.status}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-slate-900">Quick Actions</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              {can('meeting.create') && (
                <Link to="/meetings" className="block">
                  <Button variant="primary" className="w-full justify-start" size="md">
                    <Plus className="h-4 w-4" />
                    New Meeting
                  </Button>
                </Link>
              )}
              {can('user.manage') && (
                <Link to="/users" className="block">
                  <Button variant="secondary" className="w-full justify-start" size="md">
                    <UserCog className="h-4 w-4" />
                    Manage Users
                  </Button>
                </Link>
              )}
              <Link to="/calendar" className="block">
                <Button variant="ghost" className="w-full justify-start" size="md">
                  <CalendarDays className="h-4 w-4" />
                  Open Calendar
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
