import { redirect } from "next/navigation";
import { listTestAccounts } from "@/app/yip/actions/test-login";
import { createServiceClient as createYipServiceClient } from "@/lib/yip/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TestLoginClient } from "./test-login-client";

/**
 * Super-admin gate for the YIP POV-switcher.
 *
 * Only users with a yi_directory.role_assignments row where
 *   app = 'yip'  AND  role = 'national'  AND  title ILIKE '%super%'
 *   AND  is_active = true
 * can see the one-click demo-account picker. The is_active check matters: a
 * super-admin who has been deactivated in yi_directory must lose the POV
 * switcher too, and every other YIP gate (require-super-admin.ts,
 * event-access.ts) already filters on it — this call site was the only one
 * that did not.
 *
 * Everyone else is bounced to /yip/join (the public access-code entry).
 *
 * Requires an authenticated Supabase session (yi-connect OAuth). Unauth users
 * are also bounced to /yip/join — that page handles the access-code path.
 *
 * Note: yi_directory schema is not yet in the generated Supabase types
 * (migrations 023-025), so the service client is cast via `unknown` once.
 */
async function isYipSuperAdmin(): Promise<boolean> {
  // 1. Resolve currently-authenticated user (yi-connect OAuth session).
  let email: string | null = null;
  try {
    const userClient = await createServerSupabaseClient();
    const { data } = await userClient.auth.getUser();
    email = data.user?.email ?? null;
  } catch {
    return false;
  }
  if (!email) return false;

  // 2. Use service client to query yi_directory cross-schema.
  const svc = await createYipServiceClient();
  const svcDir = (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            maybeSingle: () => Promise<{ data: { id: string } | null }>;
          };
        };
      };
    };
  }).schema("yi_directory");

  // The people table in yi_directory is `people`, NOT `contestants`. This read
  // asked for yi_directory.contestants, which does not exist, so the lookup
  // always came back empty, isYipSuperAdmin() always returned false, and EVERY
  // visitor — super-admins included — was redirected to /yip/join. The POV
  // switcher had been unreachable for everyone.
  //
  // Careful: `.from("contestants")` is CORRECT everywhere else in app/yip
  // (people.ts, participant-profile.ts, mock-data.ts) because those run on the
  // default `yip` schema, where yip.contestants really does exist. Only this
  // call site switches to yi_directory, and only this one was wrong.
  const { data: person } = await svcDir
    .from("people")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!person) return false;

  // 3. Check role assignments.
  const svcDirRoles = (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => {
            eq: (k: string, v: string) => Promise<{
              data: Array<{
                role: string;
                title: string | null;
                is_active: boolean | null;
              }> | null;
            }>;
          };
        };
      };
    };
  }).schema("yi_directory");

  const { data: assignments } = await svcDirRoles
    .from("role_assignments")
    .select("role, title, is_active")
    .eq("person_id", person.id)
    .eq("app", "yip");

  // Fail CLOSED: only an explicit `true` passes, so a null/absent flag denies.
  return (assignments ?? []).some(
    (a) =>
      a.is_active === true &&
      a.role === "national" &&
      (a.title ?? "").toLowerCase().includes("super")
  );
}

export default async function TestLoginPage() {
  if (!(await isYipSuperAdmin())) {
    redirect("/yip/join");
  }
  const data = await listTestAccounts();
  return <TestLoginClient {...data} />;
}

export const metadata = {
  title: "Test Login · YIP Platform",
  description: "One-click demo access for every stakeholder POV",
};
