import api from './axios'

export async function getMeetingNotes(meetingId) {
  const { data } = await api.get(`/meetings/${meetingId}/notes`)
  return data
}

export async function createNote(meetingId, payload) {
  const { data } = await api.post(`/meetings/${meetingId}/notes`, payload)
  return data
}

export async function updateNote(meetingId, noteId, payload) {
  const { data } = await api.patch(`/meetings/${meetingId}/notes/${noteId}`, payload)
  return data
}

export async function deleteNote(meetingId, noteId) {
  const { data } = await api.delete(`/meetings/${meetingId}/notes/${noteId}`)
  return data
}
