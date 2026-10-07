"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export type DeskLink = { href: string; label: string };

export function DeskNav({ desks }: { desks: DeskLink[] }) {
  const pathname = usePathname();
  return (
    <nav className="rx-desks" aria-label="Desks">
      {desks.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className="rx-desk-link"
          aria-current={pathname === d.href || pathname.startsWith(d.href + "/") ? "page" : undefined}
        >
          {d.label}
        </Link>
      ))}
    </nav>
  );
}

export function SignOutButton() {
  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    window.location.assign("/recognitions/sign-in");
  }
  return (
    <button type="button" className="rx-btn rx-btn-quiet rx-btn-sm" onClick={signOut}>
      Sign out
    </button>
  );
}
