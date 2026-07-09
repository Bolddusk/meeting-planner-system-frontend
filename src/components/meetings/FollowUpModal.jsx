import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { getRooms } from '@/api/rooms'
import { scheduleFollowUpMeeting } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { localDatetimeToUtc } from '@/utils/datetime'
import { useAuth } from '@/hooks/useAuth'

const schema = z
  .object({
    title: z.string().optional(),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    room_id: z.coerce.number().optional(),
    meeting_link: z.union([z.string().url(), z.literal('')]).optional(),
    description: z.string().optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })

export default function FollowUpModal({ open, onClose, meeting, onCreated }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'

  const [rooms, setRooms] = useState([])
  const [submitError, setSubmitError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      start_time: '',
      end_time: '',
      room_id: '',
      meeting_link: '',
      description: '',
    },
  })

  useEffect(() => {
    if (!open || !meeting) return
    setSubmitError('')
    reset({
      title: `Follow-up: ${meeting.title}`,
      start_time: '',
      end_time: '',
      room_id: meeting.room?.id ?? '',
      meeting_link: meeting.meeting_link ?? '',
      description: meeting.description ?? '',
    })
    getRooms()
      .then((res) => setRooms(res.data ?? []))
      .catch(() => setRooms([]))
  }, [open, meeting, reset])

  const onSubmit = async (values) => {
    setSubmitError('')
    const payload = {
      start_time: localDatetimeToUtc(values.start_time, timezone),
      end_time: localDatetimeToUtc(values.end_time, timezone),
      title: values.title?.trim() || undefined,
      description: values.description?.trim() || undefined,
      meeting_link: values.meeting_link || undefined,
    }
    if (values.room_id) payload.room_id = Number(values.room_id)

    try {
      const res = await scheduleFollowUpMeeting(meeting.id, payload)
      onCreated?.(res.data)
      onClose()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule follow-up"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Create follow-up
          </Button>
        </>
      }
    >
      {submitError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <p className="mb-4 text-sm text-slate-600">
        Creates a new meeting linked to <strong>{meeting?.title}</strong>. Notes and action items
        from the source meeting will appear on the follow-up.
      </p>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input
          label="Title"
          placeholder={`Follow-up: ${meeting?.title || 'Meeting'}`}
          error={errors.title?.message}
          {...register('title')}
        />
        <Input
          label={`Start (${timezone})`}
          type="datetime-local"
          error={errors.start_time?.message}
          {...register('start_time')}
        />
        <Input
          label={`End (${timezone})`}
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
            <option value="">Use source meeting room</option>
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Optional description for the follow-up meeting"
            {...register('description')}
          />
        </div>
      </form>
    </Modal>
  )
}
