export const MEETING_STATUS_VARIANT = {
  SCHEDULED: 'info',
  RESCHEDULED: 'warning',
  IN_PROGRESS: 'success',
  COMPLETED: 'default',
  CANCELLED: 'danger',
}

export const RSVP_STATUS_VARIANT = {
  PENDING: 'default',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  TENTATIVE: 'warning',
  RESCHEDULE_REQUESTED: 'warning',
}

export const RSVP_STATUS_LABEL = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  TENTATIVE: 'Maybe',
  RESCHEDULE_REQUESTED: 'Reschedule requested',
}

export function formatRsvpStatus(status) {
  if (!status) return 'Pending'
  return RSVP_STATUS_LABEL[status] ?? status
}

export function summarizeGuestRsvps(guests = []) {
  return guests.reduce(
    (acc, guest) => {
      const key = guest.rsvp_status || 'PENDING'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    },
    { PENDING: 0, ACCEPTED: 0, DECLINED: 0, TENTATIVE: 0, RESCHEDULE_REQUESTED: 0 },
  )
}

export const CALENDAR_STATUS_COLORS = {
  SCHEDULED: '#3b82f6',
  RESCHEDULED: '#f97316',
  IN_PROGRESS: '#22c55e',
  COMPLETED: '#6b7280',
  CANCELLED: '#ef4444',
}
