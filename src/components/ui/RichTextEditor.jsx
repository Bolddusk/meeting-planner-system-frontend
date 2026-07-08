import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { cn } from '@/utils/cn'

export default function RichTextEditor({ value, onChange, placeholder, readOnly = false, className }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || 'Write note content...' }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || value === undefined) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '', false)
    }
  }, [editor, value])

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [editor, readOnly])

  if (!editor) return null

  return (
    <div className={cn('rounded-lg border border-slate-300 bg-white', className)}>
      {!readOnly && (
        <div className="flex gap-1 border-b border-slate-200 px-2 py-1.5">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            label="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            label="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            label="Bullet list"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            label="Numbered list"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-slate-800 [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400"
      />
    </div>
  )
}

function ToolbarButton({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'rounded p-1.5 text-slate-600 transition-colors hover:bg-slate-100',
        active && 'bg-primary-100 text-primary-800',
      )}
    >
      {children}
    </button>
  )
}
