import { getPermissionsForRole } from '@/utils/permissions'

export function normalizeUser(apiUser) {
  if (!apiUser) return null
  const primaryRole = apiUser.roles?.[0]
  const roleCode = primaryRole?.name ?? apiUser.role?.code ?? apiUser.role

  return {
    ...apiUser,
    role: primaryRole
      ? {
          id: primaryRole.id,
          code: primaryRole.name,
          name: primaryRole.name,
          dept_id: primaryRole.dept_id,
          department: primaryRole.department,
        }
      : apiUser.role ?? null,
    department: primaryRole?.department ?? apiUser.department ?? null,
    dept_id: primaryRole?.dept_id ?? apiUser.dept_id ?? null,
    permissions: apiUser.permissions ?? getPermissionsForRole(roleCode),
  }
}

export function getUserRoleCode(user) {
  return user?.role?.code ?? user?.roles?.[0]?.name
}
