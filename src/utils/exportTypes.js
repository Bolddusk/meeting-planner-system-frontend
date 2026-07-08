export const EXPORT_STATUS_VARIANT = {
  QUEUED: 'default',
  PROCESSING: 'info',
  READY: 'success',
  FAILED: 'danger',
}

export const EXPORT_TYPE_OPTIONS = [
  { value: 'MEETING_LOG', label: 'Meeting Log', permission: 'export.meeting_log' },
  { value: 'REPORT', label: 'Report', permission: 'export.report' },
  { value: 'ICS_INVITE', label: 'ICS Invite', permission: 'export.ics' },
]

export const FORMATS_BY_TYPE = {
  MEETING_LOG: ['PDF', 'CSV'],
  REPORT: ['PDF', 'XLSX'],
  ICS_INVITE: ['ICS'],
}
