"use client";

import { BugReporterProvider } from "@boobalan_jkkn/bug-reporter-sdk";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/yip/supabase/client";

type UserContext = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Mounts the JKKN Bug Reporter widget across the /yip app.
 *
 * - Reads the Supabase Auth user (organiser / chapter admin / national) when
 *   available and attaches it as report context.
 * - Access-code roles (students join via a 6-char code, jury via magic link)
 *   have no Supabase session — they report anonymously (userContext undefined).
 * - DISABLED on the public projector/display route (`/yip/event/[id]/display`)
 *   so the floating button never appears on the big screen during a live event.
 *
 * Mirrors components/yi-future/bug-reporter-wrapper.tsx (per-app wrapper
 * pattern; shared NEXT_PUBLIC_BUG_REPORTER_* key for the whole monorepo).
 */
export function YipBugReporterWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserContext | undefined>(undefined);
  const pathname = usePathname();

  const apiKey = process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL;

  // Keep the bug button off the public big-screen views.
  const isDisplayRoute = pathname?.includes("/display") ?? false;

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          userId: data.user.id,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            "Organiser",
          email: data.user.email ?? "",
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          userId: session.user.id,
          name:
            (session.user.user_metadata?.full_name as string | undefined) ??
            session.user.email ??
            "Organiser",
          email: session.user.email ?? "",
        });
      } else {
        setUser(undefined);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Not configured (e.g. local without keys) → render children, no widget.
  if (!apiKey || !apiUrl) {
    return <>{children}</>;
  }

  return (
    <BugReporterProvider
      apiKey={apiKey}
      apiUrl={apiUrl}
      enabled={!isDisplayRoute}
      debug={process.env.NODE_ENV === "development"}
      userContext={user}
    >
      {children}
    </BugReporterProvider>
  );
}
