import Link from "next/link";

export const metadata = {
  title: "Not Registered",
};

export default function NotRegisteredPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-orange-100 flex items-center justify-center">
          <span className="text-2xl">👋</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to Yi Connect
        </h1>
        <p className="text-gray-600 mb-6">
          You&apos;re signed in, but your email isn&apos;t registered for any Yi program yet.
          If you&apos;re a Yi member, contact your chapter chair to get added.
        </p>
        <div className="space-y-3">
          <Link
            href="/yifi"
            className="block w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors"
          >
            Browse YiFi 2026
          </Link>
          <Link
            href="/yi-future"
            className="block w-full py-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Browse YiFuture
          </Link>
        </div>
      </div>
    </main>
  );
}
