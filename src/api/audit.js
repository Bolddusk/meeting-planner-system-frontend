import api from './axios'

export async function getAuditLog(params = {}) {
  const { data } = await api.get('/audit-log', { params })
  return data
}
