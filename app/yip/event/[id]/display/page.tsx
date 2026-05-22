import { ProjectorDisplay } from "./projector-display";

export const dynamic = "force-dynamic";

export default async function DisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProjectorDisplay eventId={id} />;
}
