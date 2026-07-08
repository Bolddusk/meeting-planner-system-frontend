import { useState } from 'react'
import { Download, Eye, ChevronDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { downloadTable } from '@/utils/exportTable'

export default function ExportToolbar({
  title,
  subtitle,
  filename,
  headers,
  rows,
  disabled = false,
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const hasData = rows.length > 0

  const handleDownload = (format) => {
    downloadTable(format, { title, subtitle, filename, headers, rows })
    setMenuOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPreviewOpen(true)}
          disabled={disabled || !hasData}
        >
          <Eye className="h-4 w-4" />
          Preview
        </Button>

        <div className="relative">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={disabled || !hasData}
          >
            <Download className="h-4 w-4" />
            Download
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>

          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10"
                aria-label="Close download menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {[
                  { key: 'pdf', label: 'PDF' },
                  { key: 'excel', label: 'Excel (.xlsx)' },
                  { key: 'csv', label: 'CSV' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleDownload(item.key)}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={title} size="2xl">
        {subtitle && <p className="mb-4 text-sm text-slate-500">{subtitle}</p>}
        {!hasData ? (
          <p className="text-sm text-slate-500">No data to preview.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  {headers.map((header) => (
                    <th
                      key={header}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="max-w-xs break-words px-3 py-2 text-slate-700 [overflow-wrap:anywhere]"
                      >
                        {cell ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasData && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => handleDownload('csv')}>
              Download CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleDownload('excel')}>
              Download Excel
            </Button>
            <Button size="sm" onClick={() => handleDownload('pdf')}>
              Download PDF
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
