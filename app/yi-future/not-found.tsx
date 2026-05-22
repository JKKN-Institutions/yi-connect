import Link from "next/link";
import { BrandStrip, ProgramWordmark } from "@/components/yi-future/brand/BrandHeader";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-ivory flex flex-col">
      <header className="py-4 px-4 border-b border-navy/10 bg-white">
        <div className="max-w-5xl mx-auto">
          <ProgramWordmark />
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-lg text-center">
          <div className="text-[6rem] font-black text-navy leading-none">
            404
          </div>
          <h1 className="mt-2 text-2xl font-bold text-navy">
            This page doesn&apos;t exist
          </h1>
          <p className="mt-3 text-sm text-navy/60">
            The link may be broken, or the page may have moved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Home
            </Link>
            <Link
              href="/yi-future/tracks"
              className="px-4 py-2 rounded-md border border-navy/20 text-navy/70 text-sm font-semibold hover:border-navy/40"
            >
              Tracks
            </Link>
            <Link
              href="/yi-future/about"
              className="px-4 py-2 rounded-md border border-navy/20 text-navy/70 text-sm font-semibold hover:border-navy/40"
            >
              About
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy/10 py-6 px-4 bg-white">
        <BrandStrip />
      </footer>
    </main>
  );
}
