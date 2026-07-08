import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, UserCog } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { assignUserRole, getUsers } from '@/api/users'
import { registerUser } from '@/api/auth'
import { getMeetings } from '@/api/meetings'
import { getApiErrorMessage } from '@/api/axios'
import { formatDate } from '@/utils/formatDate'
import {
  getAssignableRoles,
  getUserDepartmentName,
  getUserPrimaryRole,
  getUserRoleName,
  ROLE_OPTIONS,
} from '@/utils/userRoles'
import { useAuth, usePermission } from '@/hooks/useAuth'

const createSchema = z
  .object({
    full_name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email required'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role_id: z.coerce.number().min(1, 'Role is required'),
    dept_id: z.coerce.number().optional(),
    timezone: z.string().default('UTC'),
  })
  .superRefine((data, ctx) => {
    const role = ROLE_OPTIONS.find((r) => r.id === Number(data.role_id))
    if (role?.needsDept && !data.dept_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Department is required for this role',
        path: ['dept_id'],
      })
    }
  })

const roleSchema = z
  .object({
    role_id: z.coerce.number().min(1, 'Role is required'),
    dept_id: z.coerce.number().optional(),
  })
  .superRefine((data, ctx) => {
    const role = ROLE_OPTIONS.find((r) => r.id === Number(data.role_id))
    if (role?.needsDept && !data.dept_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Department is required for this role',
        path: ['dept_id'],
      })
    }
  })

async function loadDepartments() {
  const deptMap = new Map()
  try {
    const usersRes = await getUsers({ limit: 100, is_active: true })
    ;(usersRes.data ?? []).forEach((u) => {
      u.roles?.forEach((r) => {
        if (r.department) deptMap.set(r.department.id, r.department)
      })
    })
  } catch {
    // continue with meetings fallback
  }

  if (deptMap.size === 0) {
    try {
      const meetingsRes = await getMeetings({ view: 'list', limit: 100 })
      ;(meetingsRes.data ?? []).forEach((m) => {
        if (m.department) deptMap.set(m.department.id, m.department)
      })
    } catch {
      // no departments available
    }
  }

  return [...deptMap.values()]
}

export default function Users() {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'
  const assignableRoles = getAssignableRoles(user)
  const canCreate = can('user.manage')
  const canAssignRole = can('user.role.assign')

  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState(null)
  const [submitError, setSubmitError] = useState('')

  const createForm = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: 4,
      dept_id: '',
      timezone: 'UTC',
    },
  })

  const roleForm = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: { role_id: 4, dept_id: '' },
  })

  const createRoleId = createForm.watch('role_id')
  const editRoleId = roleForm.watch('role_id')
  const createNeedsDept = ROLE_OPTIONS.find((r) => r.id === Number(createRoleId))?.needsDept
  const editNeedsDept = ROLE_OPTIONS.find((r) => r.id === Number(editRoleId))?.needsDept

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, limit: 20, sort: 'full_name', order: 'asc' }
      if (search) params.search = search
      const res = await getUsers(params)
      setUsers(res.data ?? [])
      setMeta(res.meta ?? { page: 1, limit: 20, total: 0, totalPages: 1 })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!createOpen && !roleTarget) return
    loadDepartments().then(setDepartments)
  }, [createOpen, roleTarget])

  const openCreate = () => {
    createForm.reset({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: assignableRoles[assignableRoles.length - 1]?.id ?? 4,
      dept_id: '',
      timezone: 'UTC',
    })
    setSubmitError('')
    setCreateOpen(true)
  }

  const openRoleEdit = (targetUser) => {
    const primary = getUserPrimaryRole(targetUser)
    roleForm.reset({
      role_id: primary?.id ?? 4,
      dept_id: primary?.dept_id ?? primary?.department?.id ?? '',
    })
    setSubmitError('')
    setRoleTarget(targetUser)
  }

  const onCreate = async (values) => {
    setSubmitError('')
    try {
      const reg = await registerUser({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        timezone: values.timezone || 'UTC',
      })

      const newUserId = reg.data?.user?.id
      if (!newUserId) throw new Error('User created but ID was not returned')

      await assignUserRole(newUserId, {
        role_id: Number(values.role_id),
        dept_id: values.dept_id ? Number(values.dept_id) : null,
      })

      setCreateOpen(false)
      await loadUsers()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err))
    }
  }

  const onAssignRole = async (values) => {
    if (!roleTarget) return
    setSubmitError('')
    try {
      await assignUserRole(roleTarget.id, {
        role_id: Number(values.role_id),
        dept_id: values.dept_id ? Number(values.dept_id) : null,
      })
      setRoleTarget(null)
      await loadUsers()
    } catch (err) {
      setSubmitError(getApiErrorMessage(err))
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="ADMINISTRATION"
        title="User Management"
        description="View users, create accounts, and assign roles and departments."
      />

      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={handleSearch} className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-24 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <Button type="submit" size="sm" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2">
                Search
              </Button>
            </form>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add user
              </Button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              No users found. {canCreate ? 'Add a user to get started.' : ''}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Created</th>
                      {canAssignRole && <th className="px-4 py-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{u.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant="default">{getUserRoleName(u)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{getUserDepartmentName(u)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={u.is_active ? 'success' : 'danger'}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDate(u.created_at, timezone)}
                        </td>
                        {canAssignRole && (
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openRoleEdit(u)}
                              disabled={u.id === user?.id}
                            >
                              <UserCog className="h-4 w-4" />
                              Role
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Page {meta.page} of {meta.totalPages} ({meta.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= meta.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add User"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createForm.handleSubmit(onCreate)} loading={createForm.formState.isSubmitting}>
              Create user
            </Button>
          </>
        }
      >
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <form className="space-y-4" onSubmit={createForm.handleSubmit(onCreate)}>
          <Input
            label="Full name"
            error={createForm.formState.errors.full_name?.message}
            {...createForm.register('full_name')}
          />
          <Input
            label="Email"
            type="email"
            error={createForm.formState.errors.email?.message}
            {...createForm.register('email')}
          />
          <Input label="Phone" error={createForm.formState.errors.phone?.message} {...createForm.register('phone')} />
          <Input
            label="Password"
            type="password"
            error={createForm.formState.errors.password?.message}
            {...createForm.register('password')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              {...createForm.register('role_id')}
            >
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {createNeedsDept && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                {...createForm.register('dept_id')}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {createForm.formState.errors.dept_id && (
                <p className="mt-1 text-sm text-red-600">{createForm.formState.errors.dept_id.message}</p>
              )}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        title={`Assign role — ${roleTarget?.full_name ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
            <Button onClick={roleForm.handleSubmit(onAssignRole)} loading={roleForm.formState.isSubmitting}>
              Save role
            </Button>
          </>
        }
      >
        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <form className="space-y-4" onSubmit={roleForm.handleSubmit(onAssignRole)}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Role</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              {...roleForm.register('role_id')}
            >
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {editNeedsDept && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                {...roleForm.register('dept_id')}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {roleForm.formState.errors.dept_id && (
                <p className="mt-1 text-sm text-red-600">{roleForm.formState.errors.dept_id.message}</p>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}
