import { adminListAgendaTemplate } from "@/app/yip/actions/admin-agenda";
import { AgendaTemplateClient } from "./agenda-template-client";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage() {
  const items = await adminListAgendaTemplate();
  return <AgendaTemplateClient initialItems={items} />;
}
