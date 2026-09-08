import Link from "next/link";
import { requireYiqSuperAdmin } from "@/lib/yiq/auth/require-super-admin";
import { getNationalBoard } from "@/app/yiq/actions/national";
import { clampFinalFieldSize } from "@/lib/yiq/national";
import { Forbidden403 } from "../_components/Forbidden403";
import { NationalConsole } from "./national-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "National ladder" };

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

export default async function NationalPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; finalField?: string }>;
}) {
  // PLATFORM gate. The national level spans every chapter, so the
  // event-scoped getYiqEventAccess deliberately does not apply here.
  const gate = await requireYiqSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403
        what="the YIQ national ladder"
        reason="not_yiq_super_admin"
      />
    );
  }

  const { category: catParam, finalField: fieldParam } = await searchParams;
  const category = catParam === "senior" ? "senior" : "junior";
  const finalFieldSize = clampFinalFieldSize(Number(fieldParam));

  const result = await getNationalBoard(category, finalFieldSize);

  return (
    <main id="yiq-main" style={{ background: INK, minHeight: "100vh", color: PAPER }}>
      <header className="border-b" style={{ borderColor: RULE }}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link href="/yiq/admin" className="text-[0.875rem]" style={{ color: DIM }}>
            ← National admin
          </Link>
          <div className="flex items-center gap-2">
            {(["junior", "senior"] as const).map((c) => (
              <Link
                key={c}
                href={`/yiq/national?category=${c}&finalField=${finalFieldSize}`}
                className="yiq-eyebrow rounded-full px-3 py-1.5"
                style={
                  c === category
                    ? { background: SAFFRON, color: INK }
                    : { background: "rgba(247,244,237,0.08)", color: DIM }
                }
              >
                {c === "junior" ? "Junior" : "Senior"}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <p className="yiq-eyebrow" style={{ color: SAFFRON }}>
          Level 2 · {category === "junior" ? "Classes 9–10" : "Classes 11–12"}
        </p>
        <h1 className="yiq-display mt-2 text-[2.5rem]">National ladder</h1>

        {!result.success ? (
          <p
            className="mt-6 rounded-xl border p-4 text-[0.9375rem]"
            style={{ borderColor: RULE, color: SAFFRON }}
          >
            {result.error}
          </p>
        ) : (
          <>
            <p className="mt-2 text-[0.9375rem]" style={{ color: DIM }}>
              {result.board.editionName} · Junior and Senior are separate
              championships and are never ranked against each other.
            </p>
            <NationalConsole board={result.board} />
          </>
        )}
      </div>
    </main>
  );
}
