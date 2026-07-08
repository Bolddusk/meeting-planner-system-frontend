import api from './axios'

export async function getActionItems(params = {}) {
  const { data } = await api.get('/action-items', { params })
  return data
}

export async function createActionItem(payload) {
  const { data } = await api.post('/action-items', payload)
  return data
}

export async function updateActionItem(id, payload) {
  const { data } = await api.patch(`/action-items/${id}`, payload)
  return data
}
