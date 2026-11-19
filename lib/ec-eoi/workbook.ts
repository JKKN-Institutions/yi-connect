/**
 * Yi Erode EC 2027 EOI: Excel (.xlsx) and ZIP builders for the admin desk.
 *
 * Ported from the design file's createDemoWorkbook() (handover PDF page 7):
 * same two sheets, same columns and order, frozen green header row, filters,
 * wrapped text, every cell stored as TEXT (so +91 numbers survive and member
 * text can never run as a spreadsheet formula). Changes from the preview:
 * real record type instead of "DEMO — NOT SUBMITTED", and row heights sized
 * to the text so long proposals are readable.
 *
 * The design used the JSZip library for packaging; here a small ZIP writer on
 * Node's built-in zlib does the same job with no extra dependency.
 * Server-only (uses node:zlib). No project imports, so it runs under node --test.
 */
import * as zlib from 'node:zlib'

// zlib.crc32 exists from Node 20.15 / 22.2; keep a table fallback for older runtimes.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(data: Uint8Array): number {
  if (typeof (zlib as { crc32?: unknown }).crc32 === 'function') return (zlib as unknown as { crc32: (d: Uint8Array) => number }).crc32(data)
  let c = 0xffffffff
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const deflateRawSync = zlib.deflateRawSync

export interface EoiExportSelection {
  id: string
  name: string
  category: string
  answer: string
}

export interface EoiExportEntry {
  id: string
  submittedAt: string
  name: string
  phone: string
  recordType: string
  selections: EoiExportSelection[]
}

// ─── minimal ZIP writer (stored + deflate entries, no zip64) ──────────────
export function buildZip(files: { name: string; data: Uint8Array | string }[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const raw = typeof file.data === 'string' ? Buffer.from(file.data, 'utf8') : Buffer.from(file.data)
    const packed = deflateRawSync(raw)
    const crc = crc32(raw) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(dosTime, 12)
    central.writeUInt16LE(dosDate, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(raw.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, packed)
    centrals.push(central, name)
    offset += local.length + name.length + packed.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

// ─── workbook ─────────────────────────────────────────────────────────────
const xml = (value: unknown) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
const column = (n: number) => {
  let result = ''
  for (n++; n; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result
  return result
}
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

/** Row height that fits the longest wrapped cell (Excel caps rows at 409 pt). */
function rowHeight(row: string[], widths: number[]): number {
  let lines = 1
  row.forEach((value, j) => {
    const perLine = Math.max(1, Math.floor(widths[j] * 1.15))
    const count = String(value ?? '')
      .split('\n')
      .reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0)
    lines = Math.max(lines, count)
  })
  return Math.min(409, Math.max(30, lines * 15 + 6))
}

function sheet(rows: string[][], widths: number[]): string {
  const last = `${column(widths.length - 1)}${rows.length}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('')}</cols><sheetData>${rows
    .map(
      (row, i) =>
        `<row r="${i + 1}" ht="${i ? rowHeight(row, widths) : 32}" customHeight="1">${row
          .map((value, j) => `<c r="${column(j)}${i + 1}" t="inlineStr" s="${i ? 1 : 2}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`)
          .join('')}</row>`
    )
    .join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`
}

export const formatIst = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

/** Only the matching applicants and only that area's proposal when areaId is given. */
export function scopeEntries(entries: EoiExportEntry[], areaId = ''): EoiExportEntry[] {
  if (!areaId) return entries
  return entries
    .filter(e => e.selections.some(s => s.id === areaId))
    .map(e => ({ ...e, selections: e.selections.filter(s => s.id === areaId) }))
}

export function createWorkbook(allEntries: EoiExportEntry[], areaId = '', teamYear = '2027'): Buffer {
  const entries = scopeEntries(allEntries, areaId)
  const members = [
    ['Entry ID', 'Submitted (IST)', 'Member name', 'Contact number', 'Selected areas', 'No. of areas', 'Mandatory commitments', 'Team year', 'Record type'],
    ...entries.map(e => [
      e.id,
      formatIst(e.submittedAt),
      e.name,
      '+91 ' + e.phone,
      e.selections.map(s => s.name).join('\n'),
      String(e.selections.length),
      'Acknowledged — all four commitments',
      teamYear,
      e.recordType,
    ]),
  ]
  const ideas = [
    ['Entry ID', 'Submitted (IST)', 'Member name', 'Contact number', 'Category', 'Selected area', 'Proposal for Erode'],
    ...entries.flatMap(e => e.selections.map(s => [e.id, formatIst(e.submittedAt), e.name, '+91 ' + e.phone, s.category, s.name, s.answer])),
  ]
  return buildZip([
    {
      name: '[Content_Types].xml',
      data: `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${[1, 2]
        .map(n => `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data: `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Members" sheetId="1" r:id="rId1"/><sheet name="Proposals" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    },
    {
      name: 'xl/styles.xml',
      data: `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF146348"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    },
    { name: 'xl/worksheets/sheet1.xml', data: sheet(members, [40, 24, 28, 22, 38, 16, 44, 12, 26]) },
    { name: 'xl/worksheets/sheet2.xml', data: sheet(ideas, [40, 24, 28, 22, 20, 24, 100]) },
  ])
}

export const EOI_FILE_PREFIX = 'Yi-Erode-EC-2027'
export const allEntriesFilename = () => `${EOI_FILE_PREFIX}-Entries.xlsx`
export const areaFilename = (areaName: string) => `${EOI_FILE_PREFIX}-${areaName.replace(/[^a-z0-9]+/gi, '-')}.xlsx`
export const zipFilename = () => `${EOI_FILE_PREFIX}-Separate-Areas.zip`

/** One workbook per area that has responses; empty areas are left out. */
export function createAreaZip(entries: EoiExportEntry[], roles: readonly { id: string; name: string }[], teamYear = '2027'): Buffer {
  const files = roles
    .filter(r => entries.some(e => e.selections.some(s => s.id === r.id)))
    .map(r => ({ name: areaFilename(r.name), data: createWorkbook(entries, r.id, teamYear) }))
  return buildZip(files)
}
