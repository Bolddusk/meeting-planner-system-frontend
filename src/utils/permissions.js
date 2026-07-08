const ALL_PERMISSIONS = [
  'org.settings.manage',
  'user.manage',
  'user.role.assign',
  'meeting.create',
  'meeting.edit',
  'meeting.cancel',
  'meeting.reschedule',
  'meeting.recurrence.configure',
  'meeting.view.scoped',
  'note.official.edit',
  'note.personal.edit',
  'export.ics',
  'export.meeting_log',
  'export.report',
  'audit.view',
  'room.manage',
  'reminder.preferences.manage',
  'rsvp.manage',
  'reschedule.request',
]

const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== 'org.settings.manage'),
  SECRETARY: [
    'meeting.create',
    'meeting.edit',
    'meeting.cancel',
    'meeting.reschedule',
    'meeting.recurrence.configure',
    'meeting.view.scoped',
    'note.official.edit',
    'note.personal.edit',
    'export.ics',
    'export.meeting_log',
    'reminder.preferences.manage',
    'rsvp.manage',
  ],
  USER: [
    'note.personal.edit',
    'export.ics',
    'rsvp.manage',
    'reminder.preferences.manage',
    'reschedule.request',
  ],
}

export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ?? []
}

export function can(user, permission) {
  if (!user?.permissions) return false
  return user.permissions.includes(permission)
}

export function getRoleCode(user) {
  return user?.role?.code ?? user?.roles?.[0]?.name ?? user?.role
}

export function hasAdminAccess(user) {
  return ['SUPER_ADMIN', 'ADMIN', 'SECRETARY'].includes(getRoleCode(user))
}

export function isUserRole(user) {
  return getRoleCode(user) === 'USER'
}

export function canAccessWebPanel(user) {
  return ['SUPER_ADMIN', 'ADMIN', 'SECRETARY', 'USER'].includes(getRoleCode(user))
}

export function canManageUsers(user) {
  return can(user, 'user.manage')
}

export function isAdminOrAbove(user) {
  return ['SUPER_ADMIN', 'ADMIN'].includes(getRoleCode(user))
}

export function canAccessExportsPage(user) {
  return can(user, 'export.meeting_log') || can(user, 'export.report')
}
