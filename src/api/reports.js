import api from './axios'

export async function getReportSummary(params = {}) {
  const { data } = await api.get('/reports/summary', { params })
  return data
}
