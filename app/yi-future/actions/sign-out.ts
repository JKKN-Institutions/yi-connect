"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/yi-future/constants";

export async function signOutDelegate() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect("/yi-future/access");
}
