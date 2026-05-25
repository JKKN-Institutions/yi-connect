import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata = {
  title: "Enter Your Code",
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

      <section className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Enter Your <span className="text-[#FD7215]">Access Code</span>
            </h1>
            <p className="text-white/50 text-sm">
              Your code was sent with your YiFi registration confirmation.
            </p>
          </div>
          <JoinForm />
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
