import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConflictModal from '@/components/meetings/ConflictModal'
import { getRooms } from '@/api/rooms'
import {
  rescheduleMeeting,
  isConflictError,
  getConflictDetails,
} from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { localDatetimeToUtc, toLocalDatetimeInput } from '@/utils/datetime'
import { useAuth } from '@/hooks/useAuth'

const schema = z
  .object({
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    room_id: z.coerce.number().optional(),
    meeting_link: z.union([z.string().url(), z.literal('')]).optional(),
    reason: z.string().optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })

export default function RescheduleModal({ open, onClose, meeting, onRescheduled }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'

  const [rooms, setRooms] = useState([])
  const [submitError, setSubmitError] = useState('')
  const [conflictDetails, setConflictDetails] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      start_time: '',
      end_time: '',
      room_id: '',
      meeting_link: '',
      reason: '',
    },
  })

  useEffect(() => {
    if (!open || !meeting) return
    setSubmitError('')
    setConflictDetails(null)
    reset({
      start_time: toLocalDatetimeInput(meeting.start_time, timezone),
      end_time: toLocalDatetimeInput(meeting.end_time, timezone),
      room_id: meeting.room?.id ?? '',
      meeting_link: meeting.meeting_link ?? '',
      reason: '',
    })
    getRooms()
      .then((res) => setRooms(res.data ?? []))
      .catch(() => setRooms([]))
  }, [open, meeting, reset, timezone])

  const onSubmit = async (values) => {
    setSubmitError('')
    const payload = {
      start_time: localDatetimeToUtc(values.start_time, timezone),
      end_time: localDatetimeToUtc(values.end_time, timezone),
      reason: values.reason || undefined,
      meeting_link: values.meeting_link || undefined,
    }
    if (values.room_id) payload.room_id = Number(values.room_id)

    try {
      await rescheduleMeeting(meeting.id, payload)
      onRescheduled?.()
      onClose()
    } catch (err) {
      if (isConflictError(err)) {
        setConflictDetails(getConflictDetails(err))
      } else {
        setSubmitError(getApiErrorMessage(err))
      }
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Reschedule meeting"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              Confirm reschedule
            </Button>
          </>
        }
      >
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label={`New start (${timezone})`}
            type="datetime-local"
            error={errors.start_time?.message}
            {...register('start_time')}
          />
          <Input
            label={`New end (${timezone})`}
            type="datetime-local"
            error={errors.end_time?.message}
            {...register('end_time')}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Room</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              {...register('room_id')}
            >
              <option value="">Keep current room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.is_virtual ? '(Virtual)' : `— ${r.location}`}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Virtual meeting link"
            placeholder="https://zoom.us/j/..."
            error={errors.meeting_link?.message}
            {...register('meeting_link')}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Reason (optional)
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Why is this meeting being rescheduled?"
              {...register('reason')}
            />
          </div>
        </form>
      </Modal>

      <ConflictModal
        open={Boolean(conflictDetails)}
        onClose={() => setConflictDetails(null)}
        details={conflictDetails}
        timezone={timezone}
      />
    </>
  )
}
