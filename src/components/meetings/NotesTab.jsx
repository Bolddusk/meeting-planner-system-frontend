import { useCallback, useEffect, useMemo, useState } from 'react'
import { Mail, Plus, Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ExportToolbar from '@/components/ui/ExportToolbar'
import LineageBanner from '@/components/meetings/LineageBanner'
import {
  getMeetingNotes,
  createNote,
  updateNote,
  deleteNote,
  distributeNotes,
} from '@/api/notes'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { NOTE_TYPE_VARIANT, OFFICIAL_NOTE_TYPES } from '@/utils/noteTypes'
import {
  buildMeetingRecipients,
  canDeleteNoteRow,
  canEditNoteInActions,
  canDistributeNotes,
  canEditNoteRow,
  canEmailNote,
  getSourceMeetingLabel,
  groupBySourceMeeting,
  normalizeNotesResponse,
  noteHasRowActions,
  shouldGroupByLineage,
  showNotesActionsColumn,
} from '@/utils/lineage'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { cn } from '@/utils/cn'

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, '').trim() || ''
}

function NoteRow({
  note,
  meeting,
  user,
  can,
  timezone,
  showActionsColumn,
  showCheckbox,
  checked,
  onToggle,
  onEdit,
  onDelete,
  onEmail,
}) {
  const showEmail = canEmailNote(meeting, user, note)
  const showEdit = canEditNoteInActions(note, user, can)
  const showDelete = canDeleteNoteRow(note, meeting, user, can)
  const hasActions = noteHasRowActions(note, meeting, user, can)

  return (
    <tr
      className={cn(
        'align-top hover:bg-slate-50',
        note.is_from_previous_meeting && 'bg-slate-50/80',
      )}
    >
      {showCheckbox && (
        <td className="w-10 px-4 py-3">
          {showEmail && (
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(note.id)}
              className="rounded border-slate-300"
            />
          )}
        </td>
      )}
      <td className="w-32 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={NOTE_TYPE_VARIANT[note.note_type] ?? 'default'}>
            {note.note_type}
          </Badge>
          {note.is_private && (
            <Badge variant="default" className="text-[10px]">
              Private
            </Badge>
          )}
          {note.is_from_previous_meeting && (
            <Badge variant="default" className="text-[10px]">
              Previous
            </Badge>
          )}
        </div>
      </td>
      <td className="w-36 break-words px-4 py-3 text-slate-700">
        {note.author?.full_name ?? '—'}
      </td>
      <td className="break-words px-4 py-3 text-slate-700 [overflow-wrap:anywhere]">
        {stripHtml(note.content) || '—'}
      </td>
      <td className="w-40 whitespace-nowrap px-4 py-3 text-slate-500">
        {formatDateTime(note.created_at, timezone)}
      </td>
      {showActionsColumn && (
        <td className="w-32 px-4 py-3">
          {hasActions ? (
            <div className="flex flex-wrap items-center gap-1">
              {showEmail && (
                <button
                  type="button"
                  onClick={() => onEmail([note.id])}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50"
                  title="Send by email"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </button>
              )}
              {showEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(note)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {showDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(note)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : null}
        </td>
      )}
    </tr>
  )
}

export default function NotesTab({ meetingId, meeting }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const canOfficialNotes = can('note.official.edit')
  const canPersonalNotes = can('note.personal.edit')
  const canEmailNotes = canDistributeNotes(meeting, user)
  const recipients = useMemo(() => buildMeetingRecipients(meeting), [meeting])

  const [lineage, setLineage] = useState(null)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = useState([])
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [distributeNoteIds, setDistributeNoteIds] = useState([])
  const [distributeRecipient, setDistributeRecipient] = useState('all')
  const [distributeMessage, setDistributeMessage] = useState('')
  const [distributing, setDistributing] = useState(false)

  const [noteType, setNoteType] = useState('MINUTES')
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const showActionsColumn = useMemo(
    () => showNotesActionsColumn(notes, meeting, user, can),
    [notes, meeting, user, can],
  )

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMeetingNotes(meetingId)
      const parsed = normalizeNotesResponse(res)
      setLineage(parsed.lineage)
      setNotes(parsed.notes)
      setSelectedNoteIds((prev) =>
        prev.filter((id) => parsed.notes.some((note) => note.id === id)),
      )
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const groupedNotes = useMemo(() => {
    if (!shouldGroupByLineage(lineage)) return null
    return groupBySourceMeeting(notes)
  }, [lineage, notes])

  const openCreate = (type) => {
    setEditingNote(null)
    setNoteType(type)
    setContent('')
    setIsPrivate(type === 'PERSONAL')
    setFormOpen(true)
  }

  const openEdit = (note) => {
    setEditingNote(note)
    setNoteType(note.note_type)
    setContent(note.content || '')
    setIsPrivate(note.is_private)
    setFormOpen(true)
  }

  const toggleNoteSelection = (noteId) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId],
    )
  }

  const openDistributeModal = (noteIds) => {
    setDistributeNoteIds(noteIds)
    setDistributeRecipient('all')
    setDistributeMessage('')
    setError('')
    setDistributeOpen(true)
  }

  const handleSave = async () => {
    const stripped = stripHtml(content)
    if (!stripped) {
      setError('Note content is required.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingNote) {
        await updateNote(meetingId, editingNote.id, { content })
      } else {
        await createNote(meetingId, {
          note_type: noteType,
          content,
          is_private: noteType === 'PERSONAL' ? isPrivate : false,
        })
      }
      setFormOpen(false)
      await loadNotes()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await deleteNote(meetingId, deleteTarget.id)
      setDeleteTarget(null)
      await loadNotes()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDistribute = async () => {
    if (distributeNoteIds.length === 0) {
      setError('Select at least one official note to email.')
      return
    }

    setDistributing(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        note_ids: distributeNoteIds,
        message: distributeMessage.trim() || undefined,
      }
      if (distributeRecipient !== 'all') {
        payload.recipients = [{ email: distributeRecipient }]
      }

      const res = await distributeNotes(meetingId, payload)
      const count = res.data?.recipient_count ?? 0
      setDistributeOpen(false)
      setDistributeMessage('')
      setDistributeNoteIds([])
      setSelectedNoteIds([])
      setSuccess(`Sent to ${count} recipient${count === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDistributing(false)
    }
  }

  const exportSubtitle = useMemo(() => {
    if (!meeting) return undefined
    return `${meeting.title} · ${formatDateTime(meeting.start_time, timezone)}`
  }, [meeting, timezone])

  const exportRows = useMemo(
    () =>
      notes.map((note) => [
        note.note_type,
        note.author?.full_name || '',
        stripHtml(note.content),
        note.is_private ? 'Yes' : 'No',
        formatDateTime(note.created_at, timezone),
        note.source_meeting?.occurrence_index
          ? `Meeting ${note.source_meeting.occurrence_index}`
          : '',
      ]),
    [notes, timezone],
  )

  const tableColSpan =
    4 + (canEmailNotes ? 1 : 0) + (showActionsColumn ? 1 : 0)

  const renderNotesTable = (noteList) => (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full table-fixed text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {canEmailNotes && <th className="w-10 px-4 py-3" />}
            <th className="w-32 px-4 py-3">Type</th>
            <th className="w-36 px-4 py-3">Author</th>
            <th className="px-4 py-3">Content</th>
            <th className="w-40 px-4 py-3">Created</th>
            {showActionsColumn && <th className="w-32 px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {noteList.length === 0 ? (
            <tr>
              <td colSpan={tableColSpan} className="px-4 py-12 text-center text-sm text-slate-500">
                No notes yet.
              </td>
            </tr>
          ) : (
            noteList.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                meeting={meeting}
                user={user}
                can={can}
                timezone={timezone}
                showActionsColumn={showActionsColumn}
                showCheckbox={canEmailNotes}
                checked={selectedNoteIds.includes(note.id)}
                onToggle={toggleNoteSelection}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onEmail={openDistributeModal}
              />
            ))
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
        <div className="flex flex-wrap gap-2">
          {canOfficialNotes && (
            <>
              <Button size="sm" onClick={() => openCreate('MINUTES')}>
                <Plus className="h-4 w-4" />
                Add minutes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openCreate('DECISION')}>
                <Plus className="h-4 w-4" />
                Add decision
              </Button>
            </>
          )}
          {canPersonalNotes && (
            <Button size="sm" variant="ghost" onClick={() => openCreate('PERSONAL')}>
              <Plus className="h-4 w-4" />
              Add personal note
            </Button>
          )}
          {canEmailNotes && (
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedNoteIds.length === 0}
              onClick={() => openDistributeModal(selectedNoteIds)}
            >
              <Mail className="h-4 w-4" />
              Send by email
              {selectedNoteIds.length > 0 ? ` (${selectedNoteIds.length})` : ''}
            </Button>
          )}
        </div>
        <ExportToolbar
          title="Meeting Notes"
          subtitle={exportSubtitle}
          filename={`meeting-${meetingId}-notes`}
          headers={['Type', 'Author', 'Content', 'Private', 'Created', 'Source']}
          rows={exportRows}
        />
      </div>

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {error && !formOpen && !distributeOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {groupedNotes ? (
        <div className="space-y-6">
          {groupedNotes.map((group) => (
            <div key={group.source?.id ?? 'current'} className="space-y-2">
              <h4 className="text-sm font-bold text-slate-800">
                {getSourceMeetingLabel(group.source, timezone)}
              </h4>
              {renderNotesTable(group.records)}
            </div>
          ))}
        </div>
      ) : (
        renderNotesTable(notes)
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingNote ? 'Edit note' : 'Add note'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingNote ? 'Save changes' : 'Create note'}
            </Button>
          </>
        }
      >
        {error && formOpen && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!editingNote && canOfficialNotes && noteType !== 'PERSONAL' && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Note type</label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {OFFICIAL_NOTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {!editingNote && noteType === 'PERSONAL' && (
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-slate-300"
            />
            Private (only visible to you)
          </label>
        )}

        <RichTextEditor value={content} onChange={setContent} />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete note"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={saving}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this note?</p>
      </Modal>

      <Modal
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        title="Send notes by email"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDistributeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDistribute} loading={distributing}>
              Send email
            </Button>
          </>
        }
      >
        {error && distributeOpen && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <p className="mb-3 text-sm text-slate-600">
          Email {distributeNoteIds.length} official note
          {distributeNoteIds.length === 1 ? '' : 's'}.
        </p>

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Recipient</label>
        <select
          value={distributeRecipient}
          onChange={(e) => setDistributeRecipient(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">All participants & guests</option>
          {recipients.map((recipient) => (
            <option key={recipient.email} value={recipient.email}>
              {recipient.label}
            </option>
          ))}
        </select>

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Optional message</label>
        <textarea
          rows={4}
          value={distributeMessage}
          onChange={(e) => setDistributeMessage(e.target.value)}
          placeholder="Please review these minutes before our next session."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </Modal>
    </div>
  )
}
