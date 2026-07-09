import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, Plus, Pencil } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import ExportToolbar from '@/components/ui/ExportToolbar'
import LineageBanner from '@/components/meetings/LineageBanner'
import { getActionItems, createActionItem, updateActionItem } from '@/api/actionItems'
import { getApiErrorMessage } from '@/api/axios'
import { formatDate, formatDateTime } from '@/utils/formatDate'
import { ACTION_ITEM_STATUS_VARIANT, ACTION_ITEM_STATUSES } from '@/utils/actionItemStatus'
import { RSVP_STATUS_VARIANT, formatRsvpStatus } from '@/utils/meetingStatus'
import {
  canUpdateActionItemStatus,
  getSourceMeetingLabel,
  groupBySourceMeeting,
  normalizeActionItemsResponse,
  shouldGroupByLineage,
  showActionItemsActionsColumn,
} from '@/utils/lineage'
import {
  assigneeDisplayName,
  assigneeKeyFromItem,
  buildMeetingAssigneeOptions,
  formatAssigneeOptionLabel,
  payloadFromAssigneeKey,
} from '@/utils/assignee'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { isAdminOrAbove, isUserRole } from '@/utils/permissions'
import { cn } from '@/utils/cn'

export default function ActionItemsTab({ meetingId, meeting }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'
  const isUser = isUserRole(user)
  const isAdmin = isAdminOrAbove(user)

  const canManage = can('note.official.edit') || can('meeting.edit')
  const assigneeOptions = useMemo(() => buildMeetingAssigneeOptions(meeting), [meeting])

  const [items, setItems] = useState([])
  const [lineage, setLineage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [remarksItem, setRemarksItem] = useState(null)
  const [remarksText, setRemarksText] = useState('')
  const [savingRemarks, setSavingRemarks] = useState(false)

  const [title, setTitle] = useState('')
  const [assigneeKey, setAssigneeKey] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('OPEN')

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getActionItems({ meetingId, limit: 100, includeLineage: true })
      const parsed = normalizeActionItemsResponse(res)
      setLineage(parsed.lineage)
      let list = parsed.items
      if (isUser) {
        list = list.filter(
          (item) => item.assignee?.type === 'USER' && item.assignee?.id === user?.id,
        )
      }
      setItems(list)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId, isUser, user?.id])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const groupedItems = useMemo(() => {
    if (!shouldGroupByLineage(lineage)) return null
    return groupBySourceMeeting(items)
  }, [lineage, items])

  const showActionsColumn = useMemo(
    () => showActionItemsActionsColumn(items, user, can),
    [items, user, can],
  )

  const canManageItem = (item) => canManage && !item.is_from_previous_meeting

  const openCreate = () => {
    setEditItem(null)
    setTitle('')
    setAssigneeKey('')
    setDueDate('')
    setStatus('OPEN')
    setFormOpen(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setTitle(item.title)
    setAssigneeKey(assigneeKeyFromItem(item.assignee))
    setDueDate(item.due_date?.slice(0, 10) ?? '')
    setStatus(item.status)
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required.')
      return
    }

    const assigneePayload = payloadFromAssigneeKey(assigneeKey)

    setSaving(true)
    setError('')
    try {
      if (editItem) {
        if (canManageItem(editItem)) {
          if (!assigneePayload) {
            setError('Select an assignee from this meeting.')
            setSaving(false)
            return
          }
          await updateActionItem(editItem.id, {
            title,
            ...assigneePayload,
            due_date: dueDate || undefined,
            status,
          })
        } else {
          await updateActionItem(editItem.id, { status })
        }
      } else {
        if (!assigneePayload) {
          setError('Select an assignee from this meeting.')
          setSaving(false)
          return
        }
        await createActionItem({
          meeting_id: Number(meetingId),
          ...assigneePayload,
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

  const openRemarksModal = (item) => {
    setRemarksItem(item)
    setRemarksText(item.remarks || '')
    setError('')
  }

  const handleSaveRemarks = async () => {
    if (!remarksItem) return
    setSavingRemarks(true)
    setError('')
    try {
      await updateActionItem(remarksItem.id, { remarks: remarksText.trim() || null })
      setRemarksItem(null)
      setRemarksText('')
      await loadItems()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSavingRemarks(false)
    }
  }

  const exportSubtitle = useMemo(() => {
    if (!meeting) return undefined
    return `${meeting.title} · ${formatDateTime(meeting.start_time, timezone)}`
  }, [meeting, timezone])

  const exportRows = useMemo(
    () =>
      items.map((item) => [
        item.title,
        assigneeDisplayName(item.assignee),
        item.due_date ? formatDate(item.due_date, timezone) : '',
        item.status,
        item.remarks || '',
        item.assignee?.rsvp_status ? formatRsvpStatus(item.assignee.rsvp_status) : '',
      ]),
    [items, timezone],
  )

  const tableColSpan = 5 + (showActionsColumn ? 1 : 0)

  const renderItemsTable = (itemList) => (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-40 px-4 py-3">Title</th>
            <th className="w-44 px-4 py-3">Assignee</th>
            <th className="w-28 px-4 py-3">Due date</th>
            <th className="w-28 px-4 py-3">Status</th>
            <th className="w-36 px-4 py-3">Remarks</th>
            {showActionsColumn && <th className="w-32 px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itemList.length === 0 ? (
            <tr>
              <td colSpan={tableColSpan} className="px-4 py-12 text-center text-sm text-slate-500">
                No action items for this meeting.
              </td>
            </tr>
          ) : (
            itemList.map((item) => {
              const canChangeStatus = canUpdateActionItemStatus(item, user, can)
              const canEdit = canManageItem(item)

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'align-top hover:bg-slate-50',
                    item.is_from_previous_meeting && 'bg-slate-50/80',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="break-words font-medium text-slate-900">{item.title}</p>
                      {item.is_from_previous_meeting && (
                        <Badge variant="default" className="text-[10px]">
                          Previous
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="break-all text-slate-700">
                        {assigneeDisplayName(item.assignee)}
                      </span>
                      {item.assignee?.type === 'GUEST' && (
                        <span className="text-xs text-slate-400">Guest</span>
                      )}
                      {item.assignee?.rsvp_status && (
                        <Badge variant={RSVP_STATUS_VARIANT[item.assignee.rsvp_status] ?? 'default'}>
                          {formatRsvpStatus(item.assignee.rsvp_status)}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {item.due_date ? formatDate(item.due_date, timezone) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_ITEM_STATUS_VARIANT[item.status]}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <p
                        className="line-clamp-2 min-w-0 flex-1 break-words text-xs text-slate-600 [overflow-wrap:anywhere]"
                        title={item.remarks || undefined}
                      >
                        {item.remarks || '—'}
                      </p>
                      {isAdmin && canManageItem(item) && (
                        <button
                          type="button"
                          onClick={() => openRemarksModal(item)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-700"
                          title={item.remarks ? 'Edit remarks' : 'Add remarks'}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  {showActionsColumn && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {canChangeStatus && (
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
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      </div>
    )
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <LineageBanner lineage={lineage} timezone={timezone} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canManage ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add action item
          </Button>
        ) : (
          <div />
        )}
        <ExportToolbar
          title="Action Items"
          subtitle={exportSubtitle}
          filename={`meeting-${meetingId}-action-items`}
          headers={['Title', 'Assignee', 'Due Date', 'Status', 'Remarks', 'RSVP Status']}
          rows={exportRows}
        />
      </div>

      {error && !formOpen && !remarksItem && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {groupedItems ? (
        <div className="space-y-6">
          {groupedItems.map((group) => (
            <div key={group.source?.id ?? 'current'} className="space-y-2">
              <h4 className="text-sm font-bold text-slate-800">
                {getSourceMeetingLabel(group.source, timezone)}
              </h4>
              {renderItemsTable(group.records)}
            </div>
          ))}
        </div>
      ) : (
        renderItemsTable(items)
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
          {!editItem || canManageItem(editItem) ? (
            <>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Assignee</label>
                <select
                  value={assigneeKey}
                  onChange={(e) => setAssigneeKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Select assignee</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {formatAssigneeOptionLabel(option)}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Only participants and guests from this meeting can be assigned.
                </p>
              </div>
              <Input
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {editItem && canManageItem(editItem) && (
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

      <Modal
        open={Boolean(remarksItem)}
        onClose={() => {
          setRemarksItem(null)
          setRemarksText('')
        }}
        title="Admin remarks"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRemarksItem(null)
                setRemarksText('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRemarks} loading={savingRemarks}>
              Save remarks
            </Button>
          </>
        }
      >
        {error && remarksItem && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="mb-3 text-sm text-slate-600">
          Action item: <strong>{remarksItem?.title}</strong>
        </p>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
        <textarea
          value={remarksText}
          onChange={(e) => setRemarksText(e.target.value)}
          rows={4}
          placeholder="Add admin-only notes for this action item..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </Modal>
    </div>
  )
}
