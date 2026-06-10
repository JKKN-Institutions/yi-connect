"use client";

/**
 * Student-facing certificate card (Phase 14) — /youth-academy/me/certificate.
 * Issued: number + issue date + download (owner-only signed URL via
 * getMyCertificateUrl). Revoked: explicit notice, no download.
 */

import { useState } from "react";
import { Award, Ban, Download, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getMyCertificateUrl } from "@/app/youth-academy/actions/certificates";
import { Button } from "@/components/ui/button";

export function CertificateCard({
  enrollmentId,
  programTitle,
  academyName,
  certificateNo,
  issuedAt,
  revoked,
}: {
  enrollmentId: string;
  programTitle: string;
  academyName: string;
  certificateNo: string;
  issuedAt: string;
  revoked: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  const issuedDate = new Date(issuedAt);
  const issuedLabel = Number.isNaN(issuedDate.getTime())
    ? null
    : issuedDate.toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  async function onDownload() {
    setDownloading(true);
    const result = await getMyCertificateUrl(enrollmentId);
    setDownloading(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
            <Award className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{programTitle}</p>
            <p className="text-sm text-slate-500">{academyName}</p>
            <p className="mt-1 text-sm text-slate-600">
              Certificate{" "}
              <span className="font-mono font-semibold text-slate-900">
                {certificateNo}
              </span>
              {issuedLabel && (
                <span className="text-slate-500"> · issued {issuedLabel}</span>
              )}
            </p>
          </div>
        </div>

        {revoked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-600">
            <Ban className="size-4" />
            Revoked
          </span>
        ) : (
          <Button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {downloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download PDF
          </Button>
        )}
      </div>

      {revoked && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          This certificate has been revoked by your chapter and can no longer
          be downloaded. Please contact your chapter team for details.
        </p>
      )}
    </div>
  );
}
