import { formatRsvpStatus } from '@/utils/meetingStatus'

export function buildMeetingAssigneeOptions(meeting) {
  const options = []

  for (const participant of meeting?.participants ?? []) {
    options.push({
      key: `user:${participant.user_id}`,
      type: 'USER',
      id: participant.user_id,
      label: participant.full_name,
      rsvp_status: participant.rsvp_status,
      isGuest: false,
    })
  }

  for (const guest of meeting?.guests ?? []) {
    options.push({
      key: `guest:${guest.id}`,
      type: 'GUEST',
      id: guest.id,
      label: guest.email,
      email: guest.email,
      rsvp_status: guest.rsvp_status,
      isGuest: true,
    })
  }

  return options
}

export function formatAssigneeOptionLabel(option) {
  const status = formatRsvpStatus(option.rsvp_status || 'PENDING')
  const guestSuffix = option.isGuest ? ' · Guest' : ''
  return `${option.label} (${status})${guestSuffix}`
}

export function assigneeKeyFromItem(assignee) {
  if (!assignee?.id) return ''
  if (assignee.type === 'GUEST') return `guest:${assignee.id}`
  if (assignee.type === 'USER') return `user:${assignee.id}`
  return `user:${assignee.id}`
}

export function payloadFromAssigneeKey(assigneeKey) {
  const [type, id] = assigneeKey.split(':')
  if (!id) return null
  if (type === 'guest') return { assignee_guest_id: Number(id) }
  if (type === 'user') return { assignee_id: Number(id) }
  return null
}

export function assigneeDisplayName(assignee) {
  if (!assignee) return '—'
  if (assignee.type === 'GUEST') {
    return assignee.email || assignee.full_name || '—'
  }
  return assignee.full_name || assignee.email || '—'
}
