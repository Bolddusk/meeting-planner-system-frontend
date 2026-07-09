import api from './axios'

export async function getNotifications(params = {}) {
  const { data } = await api.get('/notifications', { params })
  return data
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all')
  return data
}

export async function updateReminderPreferences(payload) {
  const { data } = await api.patch('/users/me/reminder-preferences', payload)
  return data
}

export async function getUnreadNotificationCount() {
  const { data } = await api.get('/notifications/unread-count')
  return data
}

export async function deleteNotification(id) {
  const { data } = await api.delete(`/notifications/${id}`)
  return data
}

export async function deleteAllNotifications() {
  const { data } = await api.delete('/notifications')
  return data
}
