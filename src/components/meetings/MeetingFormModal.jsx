import { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Plus, Trash2, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConflictModal from '@/components/meetings/ConflictModal'
import RecurrenceBuilder from '@/components/meetings/RecurrenceBuilder'
import RecurrenceScopeModal from '@/components/meetings/RecurrenceScopeModal'
import { getRooms } from '@/api/rooms'
import { getUsers } from '@/api/users'
import {
  createMeeting,
  updateMeetingScope,
  isConflictError,
  getConflictDetails,
  getMeetings,
} from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { localDatetimeToUtc, toLocalDatetimeInput } from '@/utils/datetime'
import {
  buildRRule,
  parseRRule,
  DEFAULT_RECURRENCE,
  isRecurringMeeting,
  getDayCodeFromDate,
  getMonthDayFromDate,
} from '@/utils/rrule'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { getRoleCode } from '@/utils/permissions'

const schema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    room_id: z.coerce.number().min(1, 'Room is required'),
    meeting_link: z.union([z.string().url(), z.literal('')]).optional(),
    start_time: z.string().min(1, 'Start time is required'),
    end_time: z.string().min(1, 'End time is required'),
    dept_id: z.coerce.number().optional(),
    agenda: z.array(z.object({ value: z.string() })).optional(),
    participants: z
      .array(
        z.object({
          user_id: z.number(),
          role: z.enum(['REQUIRED', 'OPTIONAL']),
          label: z.string(),
        }),
      )
      .optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: 'End time must be after start time',
    path: ['end_time'],
  })

export default function MeetingFormModal({ open, onClose, meeting, onSaved }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'
  const isEdit = Boolean(meeting?.id)
  const isSecretary = getRoleCode(user) === 'SECRETARY'
  const canConfigureRecurrence = can('meeting.recurrence.configure')

  const [rooms, setRooms] = useState([])
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [conflictDetails, setConflictDetails] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [recurrence, setRecurrence] = useState(DEFAULT_RECURRENCE)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState(null)
  const [scopeLoading, setScopeLoading] = useState(false)
  const [guests, setGuests] = useState([])
  const [guestEmail, setGuestEmail] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestError, setGuestError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      room_id: '',
      meeting_link: '',
      start_time: '',
      end_time: '',
      dept_id: user?.dept_id ?? '',
      agenda: [{ value: '' }],
      participants: [],
    },
  })

  const { fields: agendaFields, append: appendAgenda, remove: removeAgenda } = useFieldArray({
    control,
    name: 'agenda',
  })

  const participants = watch('participants') ?? []
  const startTime = watch('start_time')

  const referenceLoadedForUserRef = useRef(null)
  const loadGenerationRef = useRef(0)
  const meetingId = meeting?.id

  useEffect(() => {
    if (!open) return

    const generation = ++loadGenerationRef.current
    let cancelled = false

    setSubmitError('')
    setConflictDetails(null)
    setScopeOpen(false)
    setPendingPayload(null)

    function applyFormDefaults() {
      if (meeting) {
        reset({
          title: meeting.title ?? '',
          description: meeting.description ?? '',
          room_id: meeting.room?.id ?? '',
          meeting_link: meeting.meeting_link ?? '',
          start_time: toLocalDatetimeInput(meeting.start_time, timezone),
          end_time: toLocalDatetimeInput(meeting.end_time, timezone),
          dept_id: meeting.dept_id ?? meeting.department?.id ?? '',
          agenda:
            meeting.agenda?.length > 0
              ? meeting.agenda.map((a) => ({ value: a }))
              : [{ value: '' }],
          participants:
            meeting.participants
              ?.filter((p) => p.role !== 'ORGANIZER')
              .map((p) => ({
                user_id: p.user_id,
                role: p.role === 'OPTIONAL' ? 'OPTIONAL' : 'REQUIRED',
                label: p.full_name,
              })) ?? [],
        })
        setGuests(
          (meeting.guests ?? []).map((g) => ({ email: g.email, name: g.name ?? '' })),
        )
        if (meeting.recurrence?.rrule) {
          setRecurrence(parseRRule(meeting.recurrence.rrule))
        } else {
          setRecurrence(DEFAULT_RECURRENCE)
        }
      } else {
        reset({
          title: '',
          description: '',
          room_id: '',
          meeting_link: '',
          start_time: '',
          end_time: '',
          dept_id: isSecretary ? (user?.dept_id ?? '') : '',
          agenda: [{ value: '' }],
          participants: [],
        })
        setGuests([])
        setRecurrence(DEFAULT_RECURRENCE)
      }

      setGuestEmail('')
      setGuestName('')
      setGuestError('')
    }

    async function loadReferenceData() {
      const userId = user?.id ?? 'anonymous'
      if (referenceLoadedForUserRef.current === userId) {
        return { errors: [] }
      }

      const errors = []
      let userList = []

      try {
        const roomsRes = await getRooms()
        if (cancelled || generation !== loadGenerationRef.current) return null
        setRooms(roomsRes.data ?? [])
      } catch (err) {
        errors.push(`Rooms: ${getApiErrorMessage(err)}`)
        if (!cancelled && generation === loadGenerationRef.current) setRooms([])
      }

      try {
        const usersRes = await getUsers({ limit: 100, is_active: true })
        userList = usersRes.data ?? []
        if (cancelled || generation !== loadGenerationRef.current) return null
        setUsers(userList)
      } catch (err) {
        errors.push(`Users: ${getApiErrorMessage(err)}`)
        if (!cancelled && generation === loadGenerationRef.current) setUsers([])
      }

      const deptMap = new Map()
      userList.forEach((u) => {
        u.roles?.forEach((r) => {
          if (r.department) deptMap.set(r.department.id, r.department)
        })
      })
      if (user?.department) deptMap.set(user.department.id, user.department)

      if (deptMap.size === 0) {
        try {
          const meetingsRes = await getMeetings({ view: 'list', limit: 100 })
          if (cancelled || generation !== loadGenerationRef.current) return null
          ;(meetingsRes.data ?? []).forEach((m) => {
            if (m.department) deptMap.set(m.department.id, m.department)
          })
        } catch {
          // departments API not available; meetings fallback is best-effort
        }
      }

      if (cancelled || generation !== loadGenerationRef.current) return null
      setDepartments([...deptMap.values()])
      referenceLoadedForUserRef.current = userId

      return { errors }
    }

    async function run() {
      const needsReferenceFetch = referenceLoadedForUserRef.current !== (user?.id ?? 'anonymous')
      if (needsReferenceFetch) setLoadingData(true)

      const result = await loadReferenceData()
      if (cancelled || generation !== loadGenerationRef.current) return

      if (result?.errors?.length) {
        setSubmitError(result.errors.join(' · '))
      }

      applyFormDefaults()

      if (!cancelled && generation === loadGenerationRef.current) {
        setLoadingData(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // reset is intentionally omitted — its identity changes after reset() and retriggers this effect
  }, [open, meetingId, timezone, user?.id, user?.dept_id, user?.department?.id, isSecretary])

  useEffect(() => {
    if (!recurrence.enabled || recurrence.freq !== 'WEEKLY' || !startTime) return
    if (recurrence.byDay?.length) return
    setRecurrence((prev) => ({
      ...prev,
      byDay: [getDayCodeFromDate(localDatetimeToUtc(startTime, timezone), timezone)],
    }))
  }, [startTime, recurrence.enabled, recurrence.freq, recurrence.byDay?.length, timezone])

  useEffect(() => {
    if (!recurrence.enabled || recurrence.freq !== 'MONTHLY' || !startTime) return
    setRecurrence((prev) => ({
      ...prev,
      monthDay: getMonthDayFromDate(localDatetimeToUtc(startTime, timezone), timezone),
    }))
  }, [startTime, recurrence.enabled, recurrence.freq, timezone])

  const buildPayload = (values) => {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      room_id: Number(values.room_id),
      meeting_link: values.meeting_link || undefined,
      start_time: localDatetimeToUtc(values.start_time, timezone),
      end_time: localDatetimeToUtc(values.end_time, timezone),
      agenda: values.agenda?.map((a) => a.value).filter(Boolean) ?? [],
      participants: values.participants?.map((p) => ({
        user_id: p.user_id,
        role: p.role,
      })),
      guests: guests.map((g) => ({ email: g.email, name: g.name || undefined })),
    }
    if (values.dept_id) payload.dept_id = Number(values.dept_id)
    return payload
  }

  const submitPayload = async (payload, scope) => {
    if (recurrence.enabled && canConfigureRecurrence) {
      if (!isEdit || scope === 'series') {
        payload.rrule = buildRRule(recurrence)
      }
    }

    if (isEdit) {
      await updateMeetingScope(meeting.id, payload, scope)
    } else {
      await createMeeting(payload)
    }
    onSaved?.()
    onClose()
  }

  const onSubmit = async (values) => {
    setSubmitError('')
    const payload = buildPayload(values)

    if (isEdit && isRecurringMeeting(meeting)) {
      setPendingPayload(payload)
      setScopeOpen(true)
      return
    }

    try {
      if (isEdit) {
        await updateMeetingScope(meeting.id, payload)
      } else {
        if (recurrence.enabled && canConfigureRecurrence) {
          payload.rrule = buildRRule(recurrence)
        }
        await createMeeting(payload)
      }
      onSaved?.()
      onClose()
    } catch (err) {
      if (isConflictError(err)) {
        setConflictDetails(getConflictDetails(err))
      } else {
        setSubmitError(getApiErrorMessage(err))
      }
    }
  }

  const handleScopeConfirm = async (scope) => {
    if (!pendingPayload) return
    setScopeLoading(true)
    setSubmitError('')
    try {
      await submitPayload(pendingPayload, scope)
      setScopeOpen(false)
      setPendingPayload(null)
    } catch (err) {
      if (isConflictError(err)) {
        setConflictDetails(getConflictDetails(err))
        setScopeOpen(false)
      } else {
        setSubmitError(getApiErrorMessage(err))
      }
    } finally {
      setScopeLoading(false)
    }
  }

  const addParticipant = (u) => {
    if (u.id === user?.id) return
    if (participants.some((p) => p.user_id === u.id)) return
    setValue('participants', [
      ...participants,
      { user_id: u.id, role: 'REQUIRED', label: u.full_name },
    ])
    setPickerOpen(false)
  }

  const removeParticipant = (userId) => {
    setValue(
      'participants',
      participants.filter((p) => p.user_id !== userId),
    )
  }

  const toggleParticipantRole = (userId) => {
    setValue(
      'participants',
      participants.map((p) =>
        p.user_id === userId
          ? { ...p, role: p.role === 'REQUIRED' ? 'OPTIONAL' : 'REQUIRED' }
          : p,
      ),
    )
  }

  const addGuest = () => {
    setGuestError('')
    const email = guestEmail.trim().toLowerCase()
    const name = guestName.trim()

    if (!email) {
      setGuestError('Enter an email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestError('Enter a valid email address.')
      return
    }
    if (guests.some((g) => g.email === email)) {
      setGuestError('This email is already added.')
      return
    }
    const matchedUser = users.find((u) => u.email?.toLowerCase() === email)
    if (matchedUser) {
      setGuestError(`${matchedUser.full_name} is an existing user — select them under Participants instead.`)
      return
    }

    setGuests((prev) => [...prev, { email, name }])
    setGuestEmail('')
    setGuestName('')
  }

  const removeGuest = (email) => {
    setGuests((prev) => prev.filter((g) => g.email !== email))
  }

  const handleGuestKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addGuest()
    }
  }

  const availableUsers = users.filter(
    (u) => u.id !== user?.id && !participants.some((p) => p.user_id === u.id),
  )

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? 'Edit Meeting' : 'New Meeting'}
        size="2xl"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting || loadingData}>
              {isEdit ? 'Save changes' : 'Create meeting'}
            </Button>
          </>
        }
      >
        {loadingData ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Input label="Title" error={errors.title?.message} {...register('title')} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  {...register('description')}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Room</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  {...register('room_id')}
                >
                  <option value="">Select room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.is_virtual ? '(Virtual)' : `— ${r.location}`}
                    </option>
                  ))}
                </select>
                {errors.room_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.room_id.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  {...register('dept_id')}
                  disabled={isSecretary}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {departments.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No departments loaded. Super admin can leave this empty, or add users with
                    departments on the server.
                  </p>
                )}
              </div>

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

              <div className="md:col-span-2">
                <Input
                  label="Virtual meeting link"
                  placeholder="https://zoom.us/j/..."
                  error={errors.meeting_link?.message}
                  {...register('meeting_link')}
                />
              </div>
            </div>

            {canConfigureRecurrence && (!isEdit || meeting?.recurrence?.rrule) && (
              <RecurrenceBuilder
                value={recurrence}
                onChange={setRecurrence}
                startTime={startTime}
              />
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Agenda items</label>
                <Button type="button" variant="ghost" size="sm" onClick={() => appendAgenda({ value: '' })}>
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
              </div>
              <div className="space-y-2">
                {agendaFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder={`Agenda item ${index + 1}`}
                      {...register(`agenda.${index}.value`)}
                    />
                    {agendaFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgenda(index)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Participants</label>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen((o) => !o)}>
                  <Plus className="h-4 w-4" />
                  Add participant
                </Button>
              </div>

              {pickerOpen && (
                <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                  {availableUsers.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-slate-500">
                      {users.length <= 1
                        ? 'No other users in the system yet. Register users via backend API, then refresh this form.'
                        : 'No more users to add'}
                    </p>
                  ) : (
                    availableUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => addParticipant(u)}
                        className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white"
                      >
                        {u.full_name} <span className="text-slate-400">({u.email})</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {participants.length === 0 ? (
                <p className="text-sm text-slate-500">No additional participants added.</p>
              ) : (
                <div className="space-y-2">
                  {participants.map((p) => (
                    <div
                      key={p.user_id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-800">{p.label}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleParticipantRole(p.user_id)}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          {p.role}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeParticipant(p.user_id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary-700" />
                <label className="text-sm font-medium text-slate-700">Invite guests by email</label>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                External people who don&apos;t have an account. They&apos;ll receive an email invite with
                Accept, Maybe, and Decline buttons — no login required. Saving again re-sends the invite.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  onKeyDown={handleGuestKeyDown}
                  placeholder="guest@example.com"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={handleGuestKeyDown}
                  placeholder="Name (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-48"
                />
                <Button type="button" variant="secondary" onClick={addGuest}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {guestError && <p className="mt-1.5 text-sm text-red-600">{guestError}</p>}

              {guests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {guests.map((g) => (
                    <span
                      key={g.email}
                      className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 py-1 pl-3 pr-2 text-sm text-primary-900"
                    >
                      <Mail className="h-3.5 w-3.5 text-primary-600" />
                      <span className="font-medium">{g.name || g.email}</span>
                      {g.name && <span className="text-primary-600">({g.email})</span>}
                      <button
                        type="button"
                        onClick={() => removeGuest(g.email)}
                        className="rounded-full p-0.5 text-primary-500 hover:bg-primary-100 hover:text-primary-800"
                        aria-label={`Remove ${g.email}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>

      <RecurrenceScopeModal
        open={scopeOpen}
        action="edit"
        onConfirm={handleScopeConfirm}
        onClose={() => {
          setScopeOpen(false)
          setPendingPayload(null)
        }}
        loading={scopeLoading}
      />

      <ConflictModal
        open={Boolean(conflictDetails)}
        onClose={() => setConflictDetails(null)}
        details={conflictDetails}
        timezone={timezone}
      />
    </>
  )
}
