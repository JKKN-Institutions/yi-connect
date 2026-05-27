import { listChaptersForAdminProvisioning } from "@/app/yip/actions/admin-chapter-admins";
import { ChapterAdminsClient } from "./chapter-admins-client";

export const dynamic = "force-dynamic";

export default async function ChapterAdminsPage() {
  const res = await listChaptersForAdminProvisioning();

  if (!res.ok) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#1a1a3e]">Chapter Admins</h1>
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
          {res.error}
        </p>
      </div>
    );
  }

  return <ChapterAdminsClient chapters={res.data} />;
}
