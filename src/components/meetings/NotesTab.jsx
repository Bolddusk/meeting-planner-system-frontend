import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import RichTextEditor from '@/components/ui/RichTextEditor'
import ExportToolbar from '@/components/ui/ExportToolbar'
import {
  getMeetingNotes,
  createNote,
  updateNote,
  deleteNote,
} from '@/api/notes'
import { getApiErrorMessage } from '@/api/axios'
import { formatDateTime } from '@/utils/formatDate'
import { NOTE_TYPE_VARIANT, OFFICIAL_NOTE_TYPES, isOfficialNoteType } from '@/utils/noteTypes'
import { useAuth, usePermission } from '@/hooks/useAuth'
import { isAdminOrAbove } from '@/utils/permissions'

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, '').trim() || ''
}

export default function NotesTab({ meetingId, meeting }) {
  const { user } = useAuth()
  const { can } = usePermission()
  const timezone = user?.timezone || 'UTC'

  const canOfficialNotes = can('note.official.edit')
  const canPersonalNotes = can('note.personal.edit')

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  const [noteType, setNoteType] = useState('MINUTES')
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMeetingNotes(meetingId)
      setNotes(res.data ?? [])
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [meetingId])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  const canEditNote = (note) => {
    if (isOfficialNoteType(note.note_type)) return canOfficialNotes
    return note.author?.id === user?.id || isAdminOrAbove(user)
  }

  const canDeleteNote = (note) => canEditNote(note)

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
      ]),
    [notes, timezone],
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
        </div>
        <ExportToolbar
          title="Meeting Notes"
          subtitle={exportSubtitle}
          filename={`meeting-${meetingId}-notes`}
          headers={['Type', 'Author', 'Content', 'Private', 'Created']}
          rows={exportRows}
        />
      </div>

      {error && !formOpen && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-32 px-4 py-3">Type</th>
              <th className="w-36 px-4 py-3">Author</th>
              <th className="px-4 py-3">Content</th>
              <th className="w-40 px-4 py-3">Created</th>
              <th className="w-24 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                  No notes yet.
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={NOTE_TYPE_VARIANT[note.note_type] ?? 'default'}>
                        {note.note_type}
                      </Badge>
                      {note.is_private && (
                        <Badge variant="default" className="text-[10px]">
                          Private
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 break-words text-slate-700">
                    {note.author?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 break-words [overflow-wrap:anywhere] text-slate-700">
                    {stripHtml(note.content) || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {formatDateTime(note.created_at, timezone)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canEditNote(note) && (
                        <button
                          type="button"
                          onClick={() => openEdit(note)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteNote(note) && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(note)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}
