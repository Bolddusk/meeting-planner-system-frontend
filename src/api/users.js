import api from './axios'

export async function getUsers(params = {}) {
  const { data } = await api.get('/users', { params })
  return data
}

export async function assignUserRole(userId, payload) {
  const { data } = await api.patch(`/users/${userId}/role`, payload)
  return data
}
