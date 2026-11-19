import { NextResponse, type NextRequest } from 'next/server'
import { EOI_ROLES, EOI_TEAM_YEAR, eoiRoleById } from '@/lib/ec-eoi/catalog'
import { hasAdminSession } from '@/lib/ec-eoi/server/admin-session'
import { listEntries } from '@/lib/ec-eoi/server/data'
import { allEntriesFilename, areaFilename, createAreaZip, createWorkbook, zipFilename } from '@/lib/ec-eoi/workbook'

export const dynamic = 'force-dynamic'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function file(bytes: Buffer, name: string, type: string) {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Excel / ZIP downloads. Every request needs a valid admin session; a link alone gives nothing. */
export async function GET(request: NextRequest) {
  if (!(await hasAdminSession())) {
    return new NextResponse('Please sign in to the Yi Erode admin desk to download entries.', { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const kind = request.nextUrl.searchParams.get('kind')
  const entries = await listEntries()
  if (kind === 'all') return file(createWorkbook(entries, '', EOI_TEAM_YEAR), allEntriesFilename(), XLSX)
  if (kind === 'area') {
    const role = eoiRoleById(request.nextUrl.searchParams.get('area') ?? '')
    if (!role) return new NextResponse('Choose an area first.', { status: 400 })
    if (!entries.some(e => e.selections.some(s => s.id === role.id))) return new NextResponse('No responses for this area yet.', { status: 404 })
    return file(createWorkbook(entries, role.id, EOI_TEAM_YEAR), areaFilename(role.name), XLSX)
  }
  if (kind === 'zip') {
    if (!entries.length) return new NextResponse('No entries yet.', { status: 404 })
    return file(createAreaZip(entries, EOI_ROLES, EOI_TEAM_YEAR), zipFilename(), 'application/zip')
  }
  return new NextResponse('Unknown download.', { status: 400 })
}
