import { formatDate } from '@/utils/formatDate'
import { isAdminOrAbove, isUserRole } from '@/utils/permissions'
import { isOfficialNoteType } from '@/utils/noteTypes'

export function normalizeNotesResponse(res) {
  const data = res?.data ?? res
  if (Array.isArray(data)) {
    return { lineage: null, notes: data }
  }
  return {
    lineage: data?.lineage ?? null,
    notes: data?.notes ?? [],
  }
}

export function normalizeActionItemsResponse(res) {
  const data = res?.data ?? res
  if (Array.isArray(data)) {
    return { lineage: null, items: data, meta: res?.meta }
  }
  return {
    lineage: data?.lineage ?? null,
    items: data?.items ?? [],
    meta: res?.meta,
  }
}

export function isMeetingOrganizer(meeting, user) {
  if (!meeting || !user) return false
  return meeting.organizer?.id === user.id
}

export function canScheduleFollowUp(meeting, user, can) {
  if (!meeting || meeting.status === 'CANCELLED') return false
  if (!can('meeting.create')) return false
  return isMeetingOrganizer(meeting, user) || isAdminOrAbove(user)
}

export function canDistributeNotes(meeting, user) {
  if (!meeting) return false
  return isMeetingOrganizer(meeting, user) || isAdminOrAbove(user)
}

export function getLineageBannerMessage(lineage, timezone = 'UTC') {
  if (!lineage || lineage.type === 'STANDALONE') return null

  if (lineage.type === 'RECURRING') {
    const meetings = lineage.source_meetings ?? []
    if (meetings.length <= 1) return null
    const first = meetings[0]?.occurrence_index ?? 1
    const last = meetings[meetings.length - 1]?.occurrence_index ?? meetings.length
    return `Showing records from meetings ${first}–${last} of this series`
  }

  if (lineage.type === 'FOLLOW_UP') {
    const source = lineage.source_meetings?.[0]
    if (source) {
      return `Showing records from source meeting: ${source.title} (${formatDate(source.start_time, timezone)})`
    }
    return 'Showing records from source meeting'
  }

  return null
}

export function buildMeetingRecipients(meeting) {
  const list = []
  const seen = new Set()

  for (const p of meeting?.participants ?? []) {
    const email = p.email || p.user?.email
    if (!email || seen.has(email)) continue
    seen.add(email)
    list.push({
      email,
      label: `${p.full_name || p.user?.full_name || email} (Participant)`,
    })
  }

  for (const g of meeting?.guests ?? []) {
    if (!g.email || seen.has(g.email)) continue
    seen.add(g.email)
    list.push({
      email: g.email,
      label: `${g.name || g.email} (Guest)`,
    })
  }

  return list
}

export function canUpdateActionItemStatus(item, user, can) {
  if (can('note.official.edit')) return true
  return item.assignee?.type === 'USER' && item.assignee?.id === user?.id
}

export function canEmailNote(meeting, user, note) {
  return canDistributeNotes(meeting, user) && isOfficialNoteType(note.note_type)
}

export function canDeleteNoteRow(note, meeting, user, can) {
  if (note.is_from_previous_meeting) return false
  if (note.note_type === 'PERSONAL') {
    return note.author?.id === user?.id || isAdminOrAbove(user)
  }
  if (isOfficialNoteType(note.note_type)) {
    return canDistributeNotes(meeting, user) || can('note.official.edit')
  }
  return false
}

export function canEditNoteRow(note, user, can) {
  if (note.is_from_previous_meeting) return false
  if (isOfficialNoteType(note.note_type)) return can('note.official.edit')
  return note.author?.id === user?.id || isAdminOrAbove(user)
}

export function canEditNoteInActions(note, user, can) {
  if (isUserRole(user)) return false
  return canEditNoteRow(note, user, can)
}

export function noteHasRowActions(note, meeting, user, can) {
  return (
    canEmailNote(meeting, user, note) ||
    canDeleteNoteRow(note, meeting, user, can) ||
    canEditNoteInActions(note, user, can)
  )
}

export function showNotesActionsColumn(notes, meeting, user, can) {
  return notes.some((note) => noteHasRowActions(note, meeting, user, can))
}

export function showActionItemsActionsColumn(items, user, can) {
  const canManage = can('note.official.edit') || can('meeting.edit')
  return items.some(
    (item) => canUpdateActionItemStatus(item, user, can) || (canManage && !item.is_from_previous_meeting),
  )
}

export function getSourceMeetingLabel(source, timezone = 'UTC') {
  if (!source) return 'This meeting'
  if (source.occurrence_index) {
    return `Meeting ${source.occurrence_index} · ${formatDate(source.start_time, timezone)}`
  }
  return `${source.title || 'Source meeting'} · ${formatDate(source.start_time, timezone)}`
}

export function groupBySourceMeeting(records) {
  const groups = new Map()

  for (const record of records) {
    const source = record.source_meeting ?? null
    const key = source?.id ?? 'current'
    if (!groups.has(key)) {
      groups.set(key, { source, records: [] })
    }
    groups.get(key).records.push(record)
  }

  return Array.from(groups.values()).sort((a, b) => {
    const ai = a.source?.occurrence_index ?? Number.MAX_SAFE_INTEGER
    const bi = b.source?.occurrence_index ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return new Date(a.source?.start_time || 0) - new Date(b.source?.start_time || 0)
  })
}

export function shouldGroupByLineage(lineage) {
  return lineage?.type === 'RECURRING' || lineage?.type === 'FOLLOW_UP'
}
