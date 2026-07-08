import { useEffect, useMemo, useState } from 'react'
import { Download, FileDown, Loader2 } from 'lucide-react'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody, CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { createExport, getExport, pollExportUntilReady } from '@/api/exports'
import { getApiErrorMessage } from '@/api/axios'
import { dateInputToUtcEnd, dateInputToUtcStart } from '@/utils/datetime'
import { formatDateTime } from '@/utils/formatDate'
import {
  EXPORT_STATUS_VARIANT,
  EXPORT_TYPE_OPTIONS,
  FORMATS_BY_TYPE,
} from '@/utils/exportTypes'
import { useAuth, usePermission } from '@/hooks/useAuth'

const STORAGE_KEY = 'mp_recent_exports'

function loadRecentExports() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentExports(jobs) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 20)))
}

export default function Exports() {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const availableTypes = useMemo(
    () => EXPORT_TYPE_OPTIONS.filter((t) => can(t.permission)),
    [can],
  )

  const [exportType, setExportType] = useState(availableTypes[0]?.value ?? 'MEETING_LOG')
  const [format, setFormat] = useState('PDF')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [deptId, setDeptId] = useState('')
  const [meetingId, setMeetingId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recentJobs, setRecentJobs] = useState(loadRecentExports)
  const [pollingId, setPollingId] = useState(null)

  useEffect(() => {
    const formats = FORMATS_BY_TYPE[exportType] ?? []
    if (!formats.includes(format)) setFormat(formats[0])
  }, [exportType, format])

  const updateJob = (id, patch) => {
    setRecentJobs((prev) => {
      const next = prev.map((j) => (j.id === id ? { ...j, ...patch } : j))
      saveRecentExports(next)
      return next
    })
  }

  const handleRequestExport = async () => {
    setError('')
    setMessage('')

    if (exportType === 'ICS_INVITE' && !meetingId) {
      setError('Meeting ID is required for ICS invite exports.')
      return
    }

    setSubmitting(true)
    try {
      const filters = {}
      if (fromDate) filters.from = dateInputToUtcStart(fromDate, timezone)
      if (toDate) filters.to = dateInputToUtcEnd(toDate, timezone)
      if (deptId) filters.deptId = Number(deptId)
      if (meetingId) filters.meetingId = Number(meetingId)

      const res = await createExport({
        export_type: exportType,
        format,
        filters,
      })

      const job = {
        ...res.data,
        created_at: res.data.created_at || new Date().toISOString(),
      }

      setRecentJobs((prev) => {
        const next = [job, ...prev.filter((j) => j.id !== job.id)].slice(0, 20)
        saveRecentExports(next)
        return next
      })

      setMessage('Export queued. Processing...')
      setPollingId(job.id)

      const ready = await pollExportUntilReady(job.id)
      updateJob(job.id, ready)
      setMessage('Export ready. Click Download to save the file.')
    } catch (err) {
      if (pollingId) updateJob(pollingId, { status: 'FAILED', error_message: err.message })
      setError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
      setPollingId(null)
    }
  }

  const handleDownload = (job) => {
    if (job.download_url) {
      window.open(job.download_url, '_blank')
    }
  }

  const handleRefreshJob = async (job) => {
    if (job.status === 'READY' || job.status === 'FAILED') return
    try {
      setPollingId(job.id)
      const res = await getExport(job.id)
      if (res.data.status === 'READY' || res.data.status === 'FAILED') {
        updateJob(job.id, res.data)
        return
      }
      const ready = await pollExportUntilReady(job.id)
      updateJob(job.id, ready)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPollingId(null)
    }
  }

  if (availableTypes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHero eyebrow="REPORTS" title="Exports & Reports" description="Export meeting data." />
        <p className="text-sm text-slate-500">You do not have permission to request exports.</p>
      </div>
    )
  }

  const formatOptions = FORMATS_BY_TYPE[exportType] ?? []

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="REPORTS"
        title="Exports & Reports"
        description="Request meeting logs, summary reports, or ICS invites. Jobs process asynchronously."
      />

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Request export</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Export type</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                {availableTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                {formatOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            {exportType === 'ICS_INVITE' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Meeting ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  placeholder="e.g. 5"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">From date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">To date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              />
            </div>
            {can('export.report') && exportType !== 'ICS_INVITE' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department ID (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>
            )}
          </div>

          <Button onClick={handleRequestExport} loading={submitting} disabled={submitting}>
            <FileDown className="h-4 w-4" />
            Request export
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-slate-900">Recent exports</h3>
          <p className="text-sm text-slate-500">This session — poll refreshes status</p>
        </CardHeader>
        <CardBody className="p-0">
          {recentJobs.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">No exports requested yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">#{job.id}</td>
                      <td className="px-4 py-3 text-slate-600">{job.export_type}</td>
                      <td className="px-4 py-3 text-slate-600">{job.format}</td>
                      <td className="px-4 py-3">
                        <Badge variant={EXPORT_STATUS_VARIANT[job.status] ?? 'default'}>
                          {pollingId === job.id && job.status !== 'READY' && job.status !== 'FAILED' ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {job.status}
                            </span>
                          ) : (
                            job.status
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(job.created_at, timezone)}
                      </td>
                      <td className="px-4 py-3">
                        {job.status === 'READY' && job.download_url ? (
                          <Button size="sm" variant="secondary" onClick={() => handleDownload(job)}>
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        ) : job.status === 'FAILED' ? (
                          <span className="text-xs text-red-600">{job.error_message || 'Failed'}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRefreshJob(job)}
                            disabled={pollingId === job.id}
                          >
                            Refresh
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
