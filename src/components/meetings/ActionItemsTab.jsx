import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { getActionItems, createActionItem, updateActionItem } from '@/api/actionItems'
import { getUsers } from '@/api/users'
import { getApiErrorMessage } from '@/api/axios'
import { formatDate } from '@/utils/formatDate'
import { ACTION_ITEM_STATUS_VARIANT, ACTION_ITEM_STATUSES } from '@/utils/actionItemStatus'
import { useAuth, usePermission } from '@/hooks/useAuth'

export default function ActionItemsTab({ meetingId }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const canManage = can('note.official.edit') || can('meeting.edit')

  const [items, setItems] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('OPEN')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getActionItems({ meetingId, limit: 100 })
      setItems(res.data ?? [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!canManage) return
    getUsers({ limit: 100, is_active: true })
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]))
  }, [canManage])

  const isAssignee = (item) => item.assignee?.id === user?.id

  const canEditItem = (item) => canManage || isAssignee(item)

  const openCreate = () => {
    setEditItem(null)
    setTitle('')
    setAssigneeId('')
    setDueDate('')
    setStatus('OPEN')
    setFormOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setTitle(item.title)
    setAssigneeId(String(item.assignee?.id ?? ''))
    setDueDate(item.due_date?.slice(0, 10) ?? '')
    setStatus(item.status)
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editItem) {
        if (canManage) {
          await updateActionItem(editItem.id, {
            title,
            assignee_id: Number(assigneeId),
            due_date: dueDate || undefined,
            status,
          })
        } else {
          await updateActionItem(editItem.id, { status })
        }
      } else {
        await createActionItem({
          meeting_id: Number(meetingId),
          assignee_id: Number(assigneeId),
          title,
          due_date: dueDate || undefined,
          status: 'OPEN',
        })
      }
      setFormOpen(false)
      await loadItems()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (item, newStatus) => {
    try {
      await updateActionItem(item.id, { status: newStatus })
      await loadItems()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add action item
        </Button>
      )}

      {error && !formOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No action items for this meeting.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Due date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                  <td className="px-4 py-3 text-slate-600">{item.assignee?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {item.due_date ? formatDate(item.due_date, timezone) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canEditItem(item) && !canManage ? (
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      >
                        {ACTION_ITEM_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant={ACTION_ITEM_STATUS_VARIANT[item.status]}>{item.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEditItem(item) && (
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editItem ? 'Edit action item' : 'Add action item'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editItem ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        {error && formOpen && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {canManage || !editItem ? (
            <>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Assignee</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Select assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {editItem && canManage && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  >
                    {ACTION_ITEM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              >
                {ACTION_ITEM_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
