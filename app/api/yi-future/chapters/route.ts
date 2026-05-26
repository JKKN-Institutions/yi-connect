import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/yi-future/supabase/server";

export async function GET() {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return NextResponse.json(data ?? []);
}
