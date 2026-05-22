"use client";

import { BugReporterProvider } from "@boobalan_jkkn/bug-reporter-sdk";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/yi-future/supabase/client";

type UserContext = {
  userId: string;
  name: string;
  email: string;
};

/**
 * Wraps the app in the JKKN Bug Reporter SDK.
 * - Reads the Supabase Auth user (chapter admin / national admin) when available
 * - Access-code roles (delegate/mentor/jury/partner) report anonymously for v1;
 *   server-side enrichment can attach role context in v2.
 */
export function BugReporterWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserContext | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          userId: data.user.id,
          name:
            (data.user.user_metadata?.full_name as string | undefined) ??
            data.user.email ??
            "Admin",
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
            "Admin",
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

  return (
    <BugReporterProvider
      apiKey={process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY!}
      apiUrl={process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL!}
      enabled={true}
      debug={process.env.NODE_ENV === "development"}
      userContext={user}
    >
      {children}
    </BugReporterProvider>
  );
}
