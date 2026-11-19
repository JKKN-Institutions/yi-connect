import { EOI_ROLES } from '@/lib/ec-eoi/catalog'
import { hasAdminSession } from '@/lib/ec-eoi/server/admin-session'
import { EoiHeader } from '../EoiHeader'
import { AdminApp } from './AdminApp'

export const dynamic = 'force-dynamic'

export default async function EcEoiAdminPage() {
  const signedIn = await hasAdminSession()
  return (
    <>
      <EoiHeader />
      <div id="admin-view">
        <AdminApp signedIn={signedIn} areas={EOI_ROLES.map(r => ({ id: r.id, name: r.name }))} />
        <footer>
          <span>Yi Erode · Admin</span>
          <span>Entries are visible only after sign-in.</span>
        </footer>
      </div>
    </>
  )
}
