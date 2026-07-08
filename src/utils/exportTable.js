import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { downloadCsv } from '@/utils/csv'

/**
 * Force-wrap long unbroken strings for PDF (jspdf does not wrap on ZWSP).
 * Insert a real space every `chunkSize` characters inside non-space runs.
 */
function forceWrapForPdf(value, chunkSize = 18, maxLen = 800) {
  let text = String(value ?? '')
  if (!text) return ''

  // Normalize weird arrows / dashes for PDF width
  text = text
    .replace(/\u200b/g, '')
    .replace(/→/g, '->')
    .replace(/—/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen)}...`
  }

  return text
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part.length <= chunkSize) return part
      const chunks = []
      for (let i = 0; i < part.length; i += chunkSize) {
        chunks.push(part.slice(i, i + chunkSize))
      }
      return chunks.join(' ')
    })
    .join('')
}

function preparePdfRows(rows) {
  return rows.map((row) => row.map((cell) => forceWrapForPdf(cell)))
}

function buildColumnStyles(headers, usableWidth) {
  const styles = {}
  const count = headers.length
  if (count === 0) return styles

  const lower = headers.map((h) => String(h).toLowerCase())
  const wideIndexes = []
  const narrowIndexes = []

  lower.forEach((h, i) => {
    if (/content|changes|remarks|message|description/.test(h)) wideIndexes.push(i)
    else narrowIndexes.push(i)
  })

  // Give wide columns ~55% of width, rest split among narrow ones
  if (wideIndexes.length > 0) {
    const wideBudget = usableWidth * 0.55
    const narrowBudget = usableWidth - wideBudget
    const wideWidth = wideBudget / wideIndexes.length
    const narrowWidth = narrowBudget / Math.max(1, narrowIndexes.length)

    headers.forEach((_, index) => {
      styles[index] = {
        cellWidth: wideIndexes.includes(index) ? wideWidth : narrowWidth,
        overflow: 'linebreak',
        cellPadding: 3,
      }
    })
    return styles
  }

  const equal = usableWidth / count
  headers.forEach((_, index) => {
    styles[index] = { cellWidth: equal, overflow: 'linebreak', cellPadding: 3 }
  })
  return styles
}

export function downloadExcel(filename, headers, rows) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
  const name = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  XLSX.writeFile(workbook, name)
}

export function downloadPdf({ title, subtitle, filename, headers, rows }) {
  const landscape = true // always landscape for readable tables
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 28
  const usableWidth = pageWidth - marginX * 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 75, 55)
  doc.text('Meeting Planner System', marginX, 32)

  doc.setFontSize(13)
  doc.setTextColor(31, 41, 55)
  doc.text(String(title || 'Report'), marginX, 50)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    const lines = doc.splitTextToSize(String(subtitle), usableWidth)
    doc.text(lines, marginX, 64)
  }

  autoTable(doc, {
    head: [headers.map((h) => String(h))],
    body: preparePdfRows(rows),
    startY: subtitle ? 76 : 62,
    margin: { left: marginX, right: marginX, top: 36, bottom: 36 },
    tableWidth: usableWidth,
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      valign: 'top',
      halign: 'left',
      minCellHeight: 12,
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [15, 75, 55],
      textColor: 255,
      fontStyle: 'bold',
      overflow: 'linebreak',
      valign: 'middle',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: buildColumnStyles(headers, usableWidth),
    showHead: 'everyPage',
    rowPageBreak: 'auto',
    didParseCell(data) {
      // Hard-cap any remaining ultra-long tokens
      if (data.section === 'body' && typeof data.cell.raw === 'string') {
        const raw = data.cell.raw
        if (raw.length > 40 && !/\s/.test(raw.slice(0, 40))) {
          data.cell.text = forceWrapForPdf(raw, 16, 600).split(/\s+/)
        }
      }
    },
  })

  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  doc.save(name)
}

export function downloadTable(format, { title, subtitle, filename, headers, rows }) {
  const base = filename.replace(/\.(csv|xlsx|pdf)$/i, '')

  if (format === 'csv') {
    downloadCsv(`${base}.csv`, headers, rows)
    return
  }

  if (format === 'excel') {
    downloadExcel(base, headers, rows)
    return
  }

  if (format === 'pdf') {
    downloadPdf({ title, subtitle, filename: base, headers, rows })
  }
}
