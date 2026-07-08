import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import { getMeetings } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { CALENDAR_STATUS_COLORS } from '@/utils/meetingStatus'
import { useAuth } from '@/hooks/useAuth'

export default function Calendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const calendarRef = useRef(null)
  const [error, setError] = useState('')

  const fetchEvents = useCallback(
    async (info, successCallback, failureCallback) => {
      setError('')
      try {
        const res = await getMeetings({
          view: 'calendar',
          from: info.startStr,
          to: info.endStr,
        })
        const events = (res.data ?? []).map((m) => ({
          id: String(m.id),
          title: m.is_recurring ? `🔁 ${m.title}` : m.title,
          start: m.start,
          end: m.end,
          backgroundColor: CALENDAR_STATUS_COLORS[m.status] ?? '#3b82f6',
          borderColor: CALENDAR_STATUS_COLORS[m.status] ?? '#3b82f6',
          extendedProps: {
            status: m.status,
            room: m.room?.name,
            organizer: m.organizer?.full_name,
            is_recurring: m.is_recurring,
            recurrence_id: m.recurrence_id,
            parent_meeting_id: m.parent_meeting_id,
          },
        }))
        successCallback(events)
      } catch (err) {
        setError(getApiErrorMessage(err))
        failureCallback(err)
      }
    },
    [],
  )

  const handleEventClick = (info) => {
    navigate(`/meetings/${info.event.id}`)
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="CALENDAR"
        title="Meeting Calendar"
        description={`Month, week, and day views. Times shown in ${user?.timezone || 'UTC'}.`}
      />

      <div className="flex flex-wrap gap-3">
        {Object.entries(CALENDAR_STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            {status}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardBody className="calendar-wrapper p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            height="auto"
            timeZone={user?.timezone || 'UTC'}
            events={fetchEvents}
            eventClick={handleEventClick}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: false,
            }}
            eventDidMount={(info) => {
              const { status, room, is_recurring } = info.event.extendedProps
              const recurring = is_recurring ? ' (recurring)' : ''
              info.el.title = `${info.event.title}\n${status}${room ? ` — ${room}` : ''}${recurring}`
            }}
          />
        </CardBody>
      </Card>
    </div>
  )
}
