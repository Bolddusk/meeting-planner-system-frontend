import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { requestReschedule } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { localDatetimeToUtc } from '@/utils/datetime'
import { useAuth } from '@/hooks/useAuth'

const schema = z.object({
  message: z.string().min(1, 'Message is required'),
  proposed_start_time: z.string().optional(),
  proposed_end_time: z.string().optional(),
})

export default function RequestRescheduleModal({ open, onClose, meeting, onSent }) {
  const { user } = useAuth()
  const timezone = user?.timezone || 'UTC'
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { message: '', proposed_start_time: '', proposed_end_time: '' },
  })

  useEffect(() => {
    if (!open) return
    setSubmitError('')
    setSuccessMessage('')
    reset({ message: '', proposed_start_time: '', proposed_end_time: '' })
  }, [open, reset])

  const onSubmit = async (values) => {
    setSubmitError('')
    const payload = { message: values.message }
    if (values.proposed_start_time) {
      payload.proposed_start_time = localDatetimeToUtc(values.proposed_start_time, timezone)
    }
    if (values.proposed_end_time) {
      payload.proposed_end_time = localDatetimeToUtc(values.proposed_end_time, timezone)
    }

    try {
      const res = await requestReschedule(meeting.id, payload)
      setSuccessMessage(res.data?.message || 'Reschedule request sent to the organizer.')
      onSent?.()
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setSubmitError(getApiErrorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request reschedule"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            Send request
          </Button>
        </>
      }
    >
      {submitError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Explain why you need to reschedule..."
            {...register('message')}
          />
          {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
        </div>

        <p className="text-xs text-slate-500">Proposed new time (optional)</p>
        <Input
          label={`Proposed start (${timezone})`}
          type="datetime-local"
          {...register('proposed_start_time')}
        />
        <Input
          label={`Proposed end (${timezone})`}
          type="datetime-local"
          {...register('proposed_end_time')}
        />
      </form>
    </Modal>
  )
}
