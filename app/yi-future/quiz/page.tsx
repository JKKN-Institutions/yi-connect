import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { QuizClient } from "./quiz-client";

type TrackMini = {
  slug: string;
  name: string;
  color_hex: string | null;
  icon: string | null;
  description: string | null;
};

async function getTracks(): Promise<TrackMini[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("slug, name, color_hex, icon, description")
    .order("display_order", { ascending: true });
  return (data as unknown as TrackMini[]) ?? [];
}

export const metadata = {
  title: "Track Quiz — Future 6.0",
};

export default async function QuizPage() {
  const tracks = await getTracks();
  return <QuizClient tracks={tracks} />;
}
