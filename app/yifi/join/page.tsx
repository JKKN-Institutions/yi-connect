import Link from "next/link";
import { JoinDoors } from "./join-doors";

export const metadata = {
  title: "Register · YiFi 2026",
};

export default function JoinPage() {
  return (
    <main className="min-h-screen bg-[#000066] flex flex-col">
      <header className="border-b border-white/10 bg-black/30 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/yifi" className="text-white/70 hover:text-white text-sm font-medium">
            ← YiFi 2026
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <JoinDoors />
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 px-4 text-center">
        <p className="text-xs text-white/30">
          YiFi 2026 — Built for Generations · Part of Yi Connect
        </p>
      </footer>
    </main>
  );
}
