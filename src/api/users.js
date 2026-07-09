import api from './axios'

export async function getUsers(params = {}) {
  const { data } = await api.get('/users', { params })
  return data
}

export async function assignUserRole(userId, payload) {
  const { data } = await api.patch(`/users/${userId}/role`, payload)
  return data
}

export async function updateProfile(payload) {
  const { data } = await api.patch('/users/me', payload)
  return data
}

export async function changePassword(payload) {
  const { data } = await api.patch('/users/me/password', payload)
  return data
}

export async function uploadAvatar(imageDataUrl) {
  const { data } = await api.post('/users/me/avatar', { image: imageDataUrl })
  return data
}

export async function fetchAvatarBlob() {
  const { data } = await api.get('/users/me/avatar', { responseType: 'blob' })
  return data
}
