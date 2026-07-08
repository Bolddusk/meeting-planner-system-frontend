import api from './axios'

export async function createExport(payload) {
  const { data } = await api.post('/exports', payload)
  return data
}

export async function getExport(id) {
  const { data } = await api.get(`/exports/${id}`)
  return data
}

export async function pollExportUntilReady(id, { intervalMs = 2000, maxAttempts = 30 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await getExport(id)
    const job = res.data
    if (job.status === 'READY') return job
    if (job.status === 'FAILED') {
      throw new Error(job.error_message || 'Export failed')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Export timed out')
}
