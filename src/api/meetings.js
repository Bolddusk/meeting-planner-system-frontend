import api from './axios'

export async function getMeetings(params) {
  const { data } = await api.get('/meetings', {
    params: { ...params, _t: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  })
  return data
}

export async function getMeeting(id) {
  const { data } = await api.get(`/meetings/${id}`)
  return data
}

export async function createMeeting(payload) {
  const { data } = await api.post('/meetings', payload)
  return data
}

export async function updateMeeting(id, payload, scope) {
  const config = scope ? { params: { scope } } : undefined
  const { data } = await api.patch(`/meetings/${id}`, payload, config)
  return data
}

export async function updateMeetingScope(id, payload, scope = 'this') {
  return updateMeeting(id, payload, scope)
}

export async function cancelMeeting(id, scope) {
  const config = scope ? { params: { scope } } : undefined
  const { data } = await api.delete(`/meetings/${id}`, config)
  return data
}

export async function cancelMeetingScope(id, scope = 'this') {
  return cancelMeeting(id, scope)
}

export async function rsvpMeeting(id, status) {
  const { data } = await api.post(`/meetings/${id}/rsvp`, { status })
  return data
}

export async function checkInMeeting(id) {
  const { data } = await api.post(`/meetings/${id}/check-in`)
  return data
}

export async function rescheduleMeeting(id, payload) {
  const { data } = await api.post(`/meetings/${id}/reschedule`, payload)
  return data
}

export async function requestReschedule(id, payload) {
  const { data } = await api.post(`/meetings/${id}/reschedule-request`, payload)
  return data
}

export function isConflictError(error) {
  return error?.response?.status === 409
}

export function getConflictDetails(error) {
  return error?.response?.data?.error?.details ?? null
}

export async function downloadMeetingIcs(meetingId) {
  const response = await api.get(`/meetings/${meetingId}/invite.ics`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `meeting-${meetingId}.ics`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function scheduleFollowUpMeeting(sourceMeetingId, payload) {
  const { data } = await api.post(`/meetings/${sourceMeetingId}/follow-up`, payload)
  return data
}

export async function getPersonalNote(meetingId) {
  const { data } = await api.get(`/meetings/${meetingId}/note`)
  return data
}

export async function savePersonalNote(meetingId, payload) {
  const { data } = await api.put(`/meetings/${meetingId}/note`, payload)
  return data
}

export async function getMyRescheduleRequest(meetingId) {
  const { data } = await api.get(`/meetings/${meetingId}/reschedule-requests/mine`)
  return data
}

export async function getRescheduleRequests(meetingId) {
  const { data } = await api.get(`/meetings/${meetingId}/reschedule-requests`)
  return data
}
