import { Building2, School } from "lucide-react";
import type { PublicAcademy } from "./data";

/**
 * "Our Network" — public showcase of ALL active academies (Phase 8 landing).
 * Logo (yuva-public bucket), display name, chapter, institution when known.
 * Pure presentational, RSC-safe.
 */
export function AcademyNetworkSection({
  academies,
}: {
  academies: PublicAcademy[];
}) {
  return (
    <section id="network" className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="text-sm font-semibold tracking-widest text-amber-600 uppercase">
          Our Network
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          Yi Youth Academies across India
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Physical, branded leadership spaces inside YUVA partner institutions
          — set up by Yi National and run by local Yi chapters.
        </p>

        {academies.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <School className="mx-auto size-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              The first academies are being set up right now — this network
              showcase will fill in as they go live.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {academies.map((academy) => (
              <div
                key={academy.id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
              >
                {academy.logo_url ? (
                  // Plain <img>: Supabase public-bucket host may not be in the
                  // next/image allowlist (same note as mentor-card.tsx).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={academy.logo_url}
                    alt={`${academy.display_name} logo`}
                    className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Building2 className="size-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    {academy.display_name}
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Yi {academy.chapter}
                    {academy.institution_name
                      ? ` · ${academy.institution_name}`
                      : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
