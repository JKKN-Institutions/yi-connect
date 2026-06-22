import Link from "next/link";
import { ShieldAlert } from "lucide-react";

type Forbidden403Props = {
  reason?: string;
  contactEmail?: string;
};

/**
 * Explicit access-denied surface for the Varnam Vizha vertical. Render this
 * (never silent-redirect) when a gate fails — a silent redirect creates an
 * undiagnosable bounce-loop.
 */
export function Forbidden403({
  reason = "You don't have access to this area.",
  contactEmail = "erodevarnamvizha@gmail.com",
}: Forbidden403Props) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#3B0A45]/10 bg-white shadow-sm">
        <div className="border-l-[3px] border-l-[#D6336C] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D6336C]/10">
              <ShieldAlert className="size-6 text-[#D6336C]" />
            </div>
            <h1 className="font-[family-name:var(--font-vv-display)] text-xl font-semibold text-[#3B0A45]">
              Access Denied
            </h1>
          </div>

          <p className="mb-2 text-sm text-[#2B0A33]/70">{reason}</p>
          <p className="mb-6 text-sm text-[#2B0A33]/50">
            If you believe this is a mistake, contact{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="font-medium text-[#0CA4A5] hover:underline"
            >
              {contactEmail}
            </a>
            .
          </p>

          <Link
            href="/varnam-vizha"
            className="inline-flex items-center justify-center rounded-lg bg-[#3B0A45] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B0A33]"
          >
            Back to Varnam Vizha
          </Link>
        </div>
      </div>
    </div>
  );
}
