import { NextResponse } from "next/server";
import { createClient } from "@/lib/yi-future/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL(
      "/yi-future/login",
      process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app"
    ),
    { status: 303 }
  );
}
