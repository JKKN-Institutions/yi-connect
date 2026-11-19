import { EOI_ROLES } from '@/lib/ec-eoi/catalog'
import { getEoiAdminAccess } from '@/lib/ec-eoi/server/admin-session'
import { EoiHeader } from '../EoiHeader'
import { AdminApp } from './AdminApp'

export const dynamic = 'force-dynamic'

export default async function EcEoiAdminPage() {
  const access = await getEoiAdminAccess()
  const gate = access.allowed ? 'allowed' : access.signedIn ? 'no-access' : 'signed-out'
  return (
    <>
      <EoiHeader />
      <div id="admin-view">
        <AdminApp gate={gate} email={access.email} areas={EOI_ROLES.map(r => ({ id: r.id, name: r.name }))} />
        <footer>
          <span>Yi Erode · Admin</span>
          <span>Entries are visible only after sign-in.</span>
        </footer>
      </div>
    </>
  )
}
