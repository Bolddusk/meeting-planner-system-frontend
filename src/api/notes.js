import api from './axios'

export async function getMeetingNotes(meetingId, params = {}) {
  const { data } = await api.get(`/meetings/${meetingId}/notes`, {
    params: { includeLineage: true, ...params },
  })
  return data
}

export async function distributeNotes(meetingId, payload) {
  const { data } = await api.post(`/meetings/${meetingId}/notes/distribute`, payload)
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
