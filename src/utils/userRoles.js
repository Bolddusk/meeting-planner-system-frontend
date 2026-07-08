export const ROLE_OPTIONS = [
  { id: 1, code: 'SUPER_ADMIN', label: 'Super Admin', needsDept: false },
  { id: 2, code: 'ADMIN', label: 'Admin', needsDept: false },
  { id: 3, code: 'SECRETARY', label: 'Secretary', needsDept: true },
  { id: 4, code: 'USER', label: 'User', needsDept: true },
]

export function getAssignableRoles(actor) {
  const code = actor?.role?.code ?? actor?.roles?.[0]?.name
  if (code === 'SUPER_ADMIN') return ROLE_OPTIONS
  if (code === 'ADMIN') return ROLE_OPTIONS.filter((r) => ['SECRETARY', 'USER'].includes(r.code))
  return []
}

export function getUserPrimaryRole(user) {
  return user?.roles?.[0] ?? null
}

export function getUserDepartmentName(user) {
  return getUserPrimaryRole(user)?.department?.name ?? '—'
}

export function getUserRoleName(user) {
  return getUserPrimaryRole(user)?.name ?? '—'
}
