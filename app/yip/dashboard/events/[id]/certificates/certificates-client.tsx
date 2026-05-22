"use client";

import { useState, useRef, useCallback } from "react";
import type {
  CertificateData,
  CertificateParticipant,
  CertificateEventData,
} from "@/app/actions/certificates";
import { ROLE_LABELS } from "@/lib/yip/constants";
import { ParticipationCert } from "@/components/yip/certificates/participation-cert";
import { AwardCert } from "@/components/yip/certificates/award-cert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Printer,
  Eye,
  X,
  AlertCircle,
  FileText,
  Trophy,
  Users,
} from "lucide-react";

// ─── Print styles injected into iframe ───────────────────────────

const PRINT_STYLES = `
  @page {
    size: A4 landscape;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
  }
  .cert-page {
    page-break-after: always;
    page-break-inside: avoid;
  }
  .cert-page:last-child {
    page-break-after: auto;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

// ─── Component ──────────────────────────────────────────────────

export function CertificatesClient({
  eventId,
  eventName,
  resultsPublished,
  chapterName,
  certData,
}: {
  eventId: string;
  eventName: string;
  resultsPublished: boolean;
  chapterName: string | null;
  certData: CertificateData | null;
}) {
  const [chairName, setChairName] = useState(
    chapterName ? `${chapterName} Chair` : "Chapter Chair"
  );
  const [previewParticipant, setPreviewParticipant] =
    useState<CertificateParticipant | null>(null);
  const [previewType, setPreviewType] = useState<"award" | "participation">(
    "participation"
  );
  const printFrameRef = useRef<HTMLIFrameElement>(null);

  // ─── Not published state ─────────────────────────────────────

  if (!resultsPublished) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
          <AlertCircle className="mb-4 size-12 text-amber-400" />
          <h3 className="text-lg font-semibold text-gray-700">
            Results Not Published
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Publish results first to generate certificates. Go to the Results
            tab and click &quot;Publish Results&quot;.
          </p>
        </div>
      </div>
    );
  }

  if (!certData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-16 text-center">
          <AlertCircle className="mb-4 size-12 text-red-400" />
          <h3 className="text-lg font-semibold text-gray-700">
            Failed to Load Data
          </h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Could not load certificate data. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  const { event, participants } = certData;

  // Separate award winners from regular participants
  const awardWinners = participants.filter(
    (p) => p.award_category && p.award_category.length > 0
  );
  const allParticipants = participants;

  // ─── Print helpers ───────────────────────────────────────────

  function openPreview(
    p: CertificateParticipant,
    type: "award" | "participation"
  ) {
    setPreviewParticipant(p);
    setPreviewType(type);
  }

  function closePreview() {
    setPreviewParticipant(null);
  }

  return (
    <div className="space-y-6">
      {/* Hidden iframe for printing */}
      <iframe
        ref={printFrameRef}
        title="print-frame"
        style={{ display: "none", position: "absolute", width: 0, height: 0 }}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Certificates</h2>
          <p className="mt-1 text-sm text-gray-500">
            Generate and print participation and award certificates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="chair-name" className="text-xs text-gray-500">
              Chair Name (signature line)
            </Label>
            <Input
              id="chair-name"
              value={chairName}
              onChange={(e) => setChairName(e.target.value)}
              className="w-56"
              placeholder="e.g. Coimbatore Chair"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="size-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{allParticipants.length}</p>
                <p className="text-xs text-gray-500">Total Participants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="size-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{awardWinners.length}</p>
                <p className="text-xs text-gray-500">Award Winners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="size-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {allParticipants.length + awardWinners.length}
                </p>
                <p className="text-xs text-gray-500">Total Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Award Certificates Section */}
      {awardWinners.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-5 text-amber-500" />
                Award Certificates
              </CardTitle>
              <PrintAllButton
                participants={awardWinners}
                type="award"
                event={event}
                chairName={chairName}
                printFrameRef={printFrameRef}
                label="Print All Awards"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {awardWinners.map((p) => (
                <div
                  key={`award-${p.id}`}
                  className="flex items-center justify-between rounded-lg border bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Trophy className="size-5 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {p.full_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">
                          {p.school_name}
                        </span>
                        {p.parliament_role && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {ROLE_LABELS[p.parliament_role] ??
                              p.parliament_role}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="flex flex-wrap gap-1 justify-end max-w-48">
                      {p.award_category?.split(", ").map((a) => (
                        <Badge
                          key={a}
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0"
                        >
                          {a}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(p, "award")}
                    >
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                    <PrintSingleButton
                      participant={p}
                      type="award"
                      event={event}
                      chairName={chairName}
                      printFrameRef={printFrameRef}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Participation Certificates Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-5 text-blue-500" />
              Participation Certificates
            </CardTitle>
            <PrintAllButton
              participants={allParticipants}
              type="participation"
              event={event}
              chairName={chairName}
              printFrameRef={printFrameRef}
              label="Print All Participation"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {allParticipants.map((p) => (
              <div
                key={`part-${p.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {p.full_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {p.school_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        Class {p.class}
                      </span>
                      {p.parliament_role && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {ROLE_LABELS[p.parliament_role] ??
                            p.parliament_role}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPreview(p, "participation")}
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                  <PrintSingleButton
                    participant={p}
                    type="participation"
                    event={event}
                    chairName={chairName}
                    printFrameRef={printFrameRef}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview overlay */}
      {previewParticipant && (
        <CertificatePreview
          participant={previewParticipant}
          event={event}
          chairName={chairName}
          type={previewType}
          onClose={closePreview}
          printFrameRef={printFrameRef}
        />
      )}
    </div>
  );
}

// ─── Print Single Button ──────────────────────────────────────

function PrintSingleButton({
  participant,
  type,
  event,
  chairName,
  printFrameRef,
}: {
  participant: CertificateParticipant;
  type: "award" | "participation";
  event: CertificateEventData;
  chairName: string;
  printFrameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const handlePrint = useCallback(() => {
    printCertificates([participant], type, event, chairName, printFrameRef);
  }, [participant, type, event, chairName, printFrameRef]);

  return (
    <Button
      size="sm"
      className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
      onClick={handlePrint}
    >
      <Printer className="size-3.5" />
      Print
    </Button>
  );
}

// ─── Print All Button ─────────────────────────────────────────

function PrintAllButton({
  participants,
  type,
  event,
  chairName,
  printFrameRef,
  label,
}: {
  participants: CertificateParticipant[];
  type: "award" | "participation";
  event: CertificateEventData;
  chairName: string;
  printFrameRef: React.RefObject<HTMLIFrameElement | null>;
  label: string;
}) {
  const handlePrint = useCallback(() => {
    printCertificates(participants, type, event, chairName, printFrameRef);
  }, [participants, type, event, chairName, printFrameRef]);

  return (
    <Button
      size="sm"
      className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
      onClick={handlePrint}
    >
      <Printer className="size-4" />
      {label}
    </Button>
  );
}

// ─── Certificate Preview Overlay ──────────────────────────────

function CertificatePreview({
  participant,
  event,
  chairName,
  type,
  onClose,
  printFrameRef,
}: {
  participant: CertificateParticipant;
  event: CertificateEventData;
  chairName: string;
  type: "award" | "participation";
  onClose: () => void;
  printFrameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const handlePrint = useCallback(() => {
    printCertificates([participant], type, event, chairName, printFrameRef);
  }, [participant, type, event, chairName, printFrameRef]);

  const CertComponent = type === "award" ? AwardCert : ParticipationCert;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-[90vw] max-h-[90vh] overflow-auto rounded-xl bg-white p-4 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">
              Certificate Preview
            </h3>
            <p className="text-xs text-gray-500">
              {participant.full_name} &mdash;{" "}
              {type === "award" ? "Award" : "Participation"} Certificate
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
              onClick={handlePrint}
            >
              <Printer className="size-4" />
              Print Certificate
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="size-4" />
              Close
            </Button>
          </div>
        </div>

        {/* Certificate render (scaled down for preview) */}
        <div className="overflow-auto rounded-lg border bg-gray-100 p-4">
          <div
            style={{
              transform: "scale(0.55)",
              transformOrigin: "top left",
              width: "297mm",
              height: "210mm",
            }}
          >
            <CertComponent
              participant={participant}
              event={event}
              chairName={chairName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Print logic using hidden iframe ──────────────────────────

function printCertificates(
  participants: CertificateParticipant[],
  type: "award" | "participation",
  event: CertificateEventData,
  chairName: string,
  printFrameRef: React.RefObject<HTMLIFrameElement | null>,
) {
  const iframe = printFrameRef.current;
  if (!iframe) return;

  // Build the HTML content for all certificates
  const certsHtml = participants
    .map((p) => {
      const roleName = p.parliament_role
        ? (ROLE_LABELS[p.parliament_role] ?? p.parliament_role)
        : "Participant";

      const constituency = p.constituency_name
        ? `${p.constituency_name}${p.constituency_state ? `, ${p.constituency_state}` : ""}`
        : null;

      const venue = event.venue_name || event.city || "the designated venue";
      const day1 = formatDateForPrint(event.day1_date);
      const day2 = formatDateForPrint(event.day2_date);
      const sameDay = event.day1_date === event.day2_date;
      const dateText = sameDay ? `on ${day1}` : `on ${day1} &amp; ${day2}`;

      const levelLabel =
        event.level === "chapter"
          ? "Chapter"
          : event.level === "regional"
            ? "Regional"
            : event.level === "national"
              ? "National"
              : event.level;

      if (type === "award") {
        const awards = p.award_category?.split(", ") ?? [];
        return buildAwardCertHtml(
          p,
          roleName,
          constituency,
          venue,
          dateText,
          levelLabel,
          chairName,
          awards
        );
      } else {
        return buildParticipationCertHtml(
          p,
          roleName,
          constituency,
          venue,
          dateText,
          levelLabel,
          chairName
        );
      }
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Certificates</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: Georgia, 'Times New Roman', serif; }
  .cert-page {
    width: 297mm; height: 210mm;
    position: relative; overflow: hidden;
    page-break-after: always;
    page-break-inside: avoid;
  }
  .cert-page:last-child { page-break-after: auto; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>${certsHtml}</body>
</html>`;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render before printing
  setTimeout(() => {
    iframe.contentWindow?.print();
  }, 300);
}

function formatDateForPrint(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── HTML builders for print iframe ─────────────────────────

function buildParticipationCertHtml(
  p: CertificateParticipant,
  roleName: string,
  constituency: string | null,
  venue: string,
  dateText: string,
  levelLabel: string,
  chairName: string
): string {
  return `
<div class="cert-page" style="background:#FFFDF7;">
  <!-- Tricolor top -->
  <div style="position:absolute;top:0;left:0;right:0;height:8px;background:linear-gradient(to right,#FF9933 33%,#FFFFFF 33%,#FFFFFF 66%,#138808 66%);"></div>
  <!-- Tricolor bottom -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:linear-gradient(to right,#FF9933 33%,#FFFFFF 33%,#FFFFFF 66%,#138808 66%);"></div>
  <!-- Left stripe -->
  <div style="position:absolute;top:8px;left:0;bottom:8px;width:4px;background:linear-gradient(to bottom,#FF9933,#138808);"></div>
  <!-- Right stripe -->
  <div style="position:absolute;top:8px;right:0;bottom:8px;width:4px;background:linear-gradient(to bottom,#FF9933,#138808);"></div>
  <!-- Inner border -->
  <div style="position:absolute;top:16px;left:16px;right:16px;bottom:16px;border:2px solid #D4A843;border-radius:4px;"></div>
  <div style="position:absolute;top:20px;left:20px;right:20px;bottom:20px;border:1px solid #E8D5A0;border-radius:2px;"></div>

  <div style="position:relative;padding:32px 48px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin-bottom:8px;">
      <span style="font-size:11px;color:#666;letter-spacing:0.5px;">Young Indians (Yi)</span>
      <span style="font-size:11px;color:#999;">|</span>
      <span style="font-size:11px;color:#666;letter-spacing:0.5px;">Confederation of Indian Industry (CII)</span>
      <span style="font-size:11px;color:#999;">|</span>
      <span style="font-size:11px;color:#666;letter-spacing:0.5px;">Thalir Thiran Iyakkam</span>
      <span style="font-size:11px;color:#999;">|</span>
      <span style="font-size:11px;color:#666;letter-spacing:0.5px;">Bharat Rising</span>
    </div>
    <div style="font-size:14px;font-weight:bold;color:#FF9933;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">Young Indians Parliament 2.0</div>
    <h1 style="font-size:32px;font-weight:bold;color:#1a1a1a;letter-spacing:6px;text-transform:uppercase;margin:12px 0 8px;">Certificate of Participation</h1>
    <div style="width:120px;height:3px;background:linear-gradient(to right,#FF9933,#D4A843,#138808);margin:8px auto 20px;border-radius:2px;"></div>
    <p style="font-size:16px;color:#555;margin-bottom:8px;font-style:italic;">This is to certify that</p>
    <p style="font-size:36px;font-weight:bold;color:#1a1a1a;margin-bottom:4px;line-height:1.2;">${escHtml(p.full_name)}</p>
    <p style="font-size:16px;color:#555;margin-bottom:16px;">of <span style="font-weight:600;color:#333;">${escHtml(p.school_name)}</span> (Class ${p.class})</p>
    <p style="font-size:16px;color:#555;margin-bottom:6px;line-height:1.6;">participated as <strong style="color:#1a1a1a;">${escHtml(roleName)}</strong>${constituency ? ` representing <strong style="color:#1a1a1a;">${escHtml(constituency)}</strong>` : ""}</p>
    <p style="font-size:16px;color:#555;margin-bottom:6px;line-height:1.6;">in the Young Indians Parliament ${escHtml(levelLabel)} Round</p>
    <p style="font-size:16px;color:#555;margin-bottom:28px;line-height:1.6;">held at <strong style="color:#333;">${escHtml(venue)}</strong> ${dateText}</p>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;width:80%;margin-top:auto;padding-bottom:8px;">
      <div style="text-align:center;flex:1;">
        <div style="width:160px;border-bottom:1.5px solid #999;margin:0 auto 6px;"></div>
        <p style="font-size:12px;color:#666;font-weight:600;">${escHtml(chairName)}</p>
        <p style="font-size:10px;color:#999;">Chapter Chair</p>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="width:160px;border-bottom:1.5px solid #999;margin:0 auto 6px;"></div>
        <p style="font-size:12px;color:#666;font-weight:600;">Event Coordinator</p>
        <p style="font-size:10px;color:#999;">Young Indians Parliament</p>
      </div>
    </div>
  </div>
</div>`;
}

function buildAwardCertHtml(
  p: CertificateParticipant,
  roleName: string,
  constituency: string | null,
  venue: string,
  dateText: string,
  levelLabel: string,
  chairName: string,
  awards: string[]
): string {
  return `
<div class="cert-page" style="background:linear-gradient(135deg,#FFFDF7 0%,#FFF9E6 50%,#FFFDF7 100%);">
  <!-- Gold top border -->
  <div style="position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(to right,#B8860B,#D4A843,#FFD700,#D4A843,#B8860B);"></div>
  <!-- Gold bottom border -->
  <div style="position:absolute;bottom:0;left:0;right:0;height:10px;background:linear-gradient(to right,#B8860B,#D4A843,#FFD700,#D4A843,#B8860B);"></div>
  <!-- Left gold stripe -->
  <div style="position:absolute;top:10px;left:0;bottom:10px;width:6px;background:linear-gradient(to bottom,#D4A843,#FFD700,#D4A843);"></div>
  <!-- Right gold stripe -->
  <div style="position:absolute;top:10px;right:0;bottom:10px;width:6px;background:linear-gradient(to bottom,#D4A843,#FFD700,#D4A843);"></div>
  <!-- Inner border -->
  <div style="position:absolute;top:18px;left:18px;right:18px;bottom:18px;border:3px solid #D4A843;border-radius:4px;"></div>
  <div style="position:absolute;top:24px;left:24px;right:24px;bottom:24px;border:1px solid #E8D5A0;border-radius:2px;"></div>

  <div style="position:relative;padding:36px 56px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;">
    <div style="display:flex;align-items:center;justify-content:center;gap:32px;margin-bottom:6px;">
      <span style="font-size:11px;color:#8B7355;letter-spacing:0.5px;">Young Indians (Yi)</span>
      <span style="font-size:11px;color:#B8A080;">|</span>
      <span style="font-size:11px;color:#8B7355;letter-spacing:0.5px;">Confederation of Indian Industry (CII)</span>
      <span style="font-size:11px;color:#B8A080;">|</span>
      <span style="font-size:11px;color:#8B7355;letter-spacing:0.5px;">Thalir Thiran Iyakkam</span>
      <span style="font-size:11px;color:#B8A080;">|</span>
      <span style="font-size:11px;color:#8B7355;letter-spacing:0.5px;">Bharat Rising</span>
    </div>
    <div style="font-size:14px;font-weight:bold;color:#B8860B;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px;">Young Indians Parliament 2.0</div>
    <h1 style="font-size:32px;font-weight:bold;color:#1a1a1a;letter-spacing:6px;text-transform:uppercase;margin:10px 0 6px;">Certificate of Excellence</h1>
    <div style="width:140px;height:3px;background:linear-gradient(to right,#B8860B,#FFD700,#B8860B);margin:6px auto 16px;border-radius:2px;"></div>
    <p style="font-size:16px;color:#555;margin-bottom:6px;font-style:italic;">This is to certify that</p>
    <p style="font-size:36px;font-weight:bold;color:#1a1a1a;margin-bottom:4px;line-height:1.2;">${escHtml(p.full_name)}</p>
    <p style="font-size:16px;color:#555;margin-bottom:12px;">of <span style="font-weight:600;color:#333;">${escHtml(p.school_name)}</span> (Class ${p.class})</p>
    <p style="font-size:16px;color:#555;margin-bottom:4px;line-height:1.6;">participated as <strong style="color:#1a1a1a;">${escHtml(roleName)}</strong>${constituency ? ` representing <strong style="color:#1a1a1a;">${escHtml(constituency)}</strong>` : ""}</p>
    <p style="font-size:16px;color:#555;margin-bottom:4px;line-height:1.6;">in the Young Indians Parliament ${escHtml(levelLabel)} Round</p>
    <p style="font-size:16px;color:#555;margin-bottom:12px;line-height:1.6;">held at <strong style="color:#333;">${escHtml(venue)}</strong> ${dateText}</p>
    <div style="background:linear-gradient(135deg,#FFF8DC,#FFEFC4,#FFF8DC);border:2px solid #D4A843;border-radius:8px;padding:10px 32px;margin-bottom:6px;">
      <p style="font-size:15px;color:#555;margin-bottom:4px;">and was awarded</p>
      <p style="font-size:24px;font-weight:bold;color:#B8860B;line-height:1.3;">${awards.map(a => escHtml(a)).join(" &amp; ")}</p>
      <p style="font-size:13px;color:#777;font-style:italic;margin-top:2px;">for outstanding performance in parliamentary proceedings</p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;width:80%;margin-top:auto;padding-bottom:4px;">
      <div style="text-align:center;flex:1;">
        <div style="width:160px;border-bottom:1.5px solid #B8860B;margin:0 auto 6px;"></div>
        <p style="font-size:12px;color:#666;font-weight:600;">${escHtml(chairName)}</p>
        <p style="font-size:10px;color:#999;">Chapter Chair</p>
      </div>
      <div style="text-align:center;flex:1;">
        <div style="width:160px;border-bottom:1.5px solid #B8860B;margin:0 auto 6px;"></div>
        <p style="font-size:12px;color:#666;font-weight:600;">Event Coordinator</p>
        <p style="font-size:10px;color:#999;">Young Indians Parliament</p>
      </div>
    </div>
  </div>
</div>`;
}
