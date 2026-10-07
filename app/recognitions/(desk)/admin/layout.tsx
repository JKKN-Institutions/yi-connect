import { getRxViewer } from "@/lib/recognitions/auth";
import { AdminNav } from "./admin-nav";
import "./admin.css";

/** Control room frame: the section nav. Each page runs its own super-admin gate. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getRxViewer();
  return (
    <>
      {viewer?.isSuperAdmin ? <AdminNav /> : null}
      {children}
    </>
  );
}
