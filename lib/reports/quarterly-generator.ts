/**
 * Quarterly Report HTML Generator
 *
 * Renders a ReportDataSnapshot into a self-contained printable HTML page.
 *
 * Why HTML and not @react-pdf/renderer:
 *   - react-pdf adds ~4MB to the install footprint for a feature that
 *     will be used a handful of times per quarter per chapter
 *   - HTML-to-print via browser gives perfect fidelity with no binary deps
 *   - Upload flow stores the generated HTML as a .html file that Chair can
 *     print-to-PDF from their browser (or the UI includes a print button)
 *
 * The generated file is stored in Supabase Storage `chapter-reports` bucket
 * and returns a signed URL.
 */

import 'server-only';
import type { ReportDataSnapshot } from '@/types/report';

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/**
 * Render the snapshot to a complete, printable HTML document.
 */
export function renderQuarterlyReportHTML(
  snapshot: ReportDataSnapshot
): string {
  const { chapter, period, events, verticals, top_members, finance, take_pride_nominees, generated_at, generated_by } = snapshot;

  const eventRows =
    events.list.length === 0
      ? `<tr><td colspan="6" class="empty">No events completed in this quarter.</td></tr>`
      : events.list
          .map(
            (e) => `
      <tr>
        <td>${esc(e.title)}</td>
        <td>${esc(formatDate(e.start_date))}</td>
        <td>${esc(e.category)}</td>
        <td style="text-align:right">${e.rsvp_count}</td>
        <td style="text-align:right">${e.attended_count} (${Math.round(e.attendance_rate)}%)</td>
        <td style="text-align:right">${e.feedback_rating !== null ? e.feedback_rating.toFixed(1) + ' / 5' : '—'}</td>
      </tr>`
          )
          .join('');

  const verticalRows =
    verticals.list.length === 0
      ? `<tr><td colspan="5" class="empty">No verticals found.</td></tr>`
      : verticals.list
          .map(
            (v) => `
      <tr>
        <td>${esc(v.name)}</td>
        <td style="text-align:right">${v.planned_activities}</td>
        <td style="text-align:right">${v.completed_activities}</td>
        <td style="text-align:right">${v.ec_participation} / ${v.non_ec_participation}</td>
        <td><span class="badge ${v.on_track ? 'ok' : 'warn'}">${v.on_track ? 'On track' : 'Behind'}</span></td>
      </tr>`
          )
          .join('');

  const topMemberRows =
    top_members.length === 0
      ? `<tr><td colspan="4" class="empty">No engagement data recorded this quarter.</td></tr>`
      : top_members
          .map(
            (m, i) => `
      <tr>
        <td style="text-align:center;font-weight:600">${i + 1}</td>
        <td>${esc(m.full_name)}</td>
        <td style="text-align:right">${m.events_attended}</td>
        <td style="text-align:right;font-weight:600">${m.total_points}</td>
      </tr>`
          )
          .join('');

  const nomineeRows =
    take_pride_nominees.length === 0
      ? `<tr><td colspan="3" class="empty">No nominees suggested (no engagement data).</td></tr>`
      : take_pride_nominees
          .map(
            (n, i) => `
      <tr>
        <td style="text-align:center;font-weight:600">${i + 1}</td>
        <td>${esc(n.full_name)}</td>
        <td>${esc(n.rationale)}</td>
      </tr>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(chapter.name)} — ${esc(period.label)} Report</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1e293b;
    max-width: 850px;
    margin: 0 auto;
    padding: 40px 32px;
    line-height: 1.5;
    background: #ffffff;
  }
  h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #1e40af; }
  h2 { font-size: 20px; font-weight: 600; margin: 32px 0 12px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #1e40af;
  }
  .brand { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
  th { background: #f1f5f9; text-align: left; padding: 10px 8px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
  td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .empty { text-align: center; color: #94a3b8; font-style: italic; padding: 24px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #fef3c7; color: #92400e; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0 24px; }
  .summary-card { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; }
  .summary-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .summary-card .value { font-size: 24px; font-weight: 700; color: #1e293b; }
  .finance-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .finance-row { display: flex; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .finance-label { color: #64748b; }
  .finance-value { font-weight: 600; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    h2 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
  .print-btn {
    position: fixed; top: 16px; right: 16px; background: #1e40af; color: #fff;
    border: 0; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;
  }
</style>
</head>
<body>

<button onclick="window.print()" class="print-btn no-print">Print / Save as PDF</button>

<div class="header">
  <div>
    <div class="brand">Yi Connect · Chapter Report</div>
    <h1>${esc(chapter.name)}</h1>
    <div class="meta">
      ${esc(period.label)}${chapter.region ? ` · ${esc(chapter.region)} region` : ''}
    </div>
  </div>
  <div style="text-align:right;font-size:12px;color:#64748b">
    <div>Generated: ${esc(formatDate(generated_at))}</div>
    <div>By: ${esc(generated_by.name)}</div>
    <div>Fiscal Year: ${period.fiscal_year}${period.quarter ? ` · Q${period.quarter}` : ''}</div>
  </div>
</div>

<!-- Summary strip -->
<div class="summary-grid">
  <div class="summary-card">
    <div class="label">Events</div>
    <div class="value">${events.total_count}</div>
  </div>
  <div class="summary-card">
    <div class="label">Total Attendance</div>
    <div class="value">${events.total_attendance}</div>
  </div>
  <div class="summary-card">
    <div class="label">Avg Attendance</div>
    <div class="value">${Math.round(events.average_attendance_rate)}%</div>
  </div>
  <div class="summary-card">
    <div class="label">Verticals On Track</div>
    <div class="value">${verticals.on_track_count} / ${verticals.list.length}</div>
  </div>
</div>

<!-- Section 1: Events -->
<h2>1 · Events This Quarter</h2>
<table>
  <thead>
    <tr>
      <th>Event</th>
      <th>Date</th>
      <th>Category</th>
      <th style="text-align:right">RSVPs</th>
      <th style="text-align:right">Attended</th>
      <th style="text-align:right">Rating</th>
    </tr>
  </thead>
  <tbody>${eventRows}</tbody>
</table>

<!-- Section 2: Verticals -->
<h2>2 · AAA Verticals Status</h2>
<table>
  <thead>
    <tr>
      <th>Vertical</th>
      <th style="text-align:right">Planned</th>
      <th style="text-align:right">Completed</th>
      <th style="text-align:right">EC / Non-EC</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>${verticalRows}</tbody>
</table>

<!-- Section 3: Top Members -->
<h2>3 · Top 10 Members by Engagement</h2>
<table>
  <thead>
    <tr>
      <th style="width:50px;text-align:center">#</th>
      <th>Member</th>
      <th style="text-align:right">Events Attended</th>
      <th style="text-align:right">Points</th>
    </tr>
  </thead>
  <tbody>${topMemberRows}</tbody>
</table>

<!-- Section 4: Finance -->
<h2>4 · Financial Snapshot</h2>
<div class="finance-grid">
  <div class="finance-row">
    <span class="finance-label">Total Expenses</span>
    <span class="finance-value">${esc(formatCurrency(finance.total_expenses))}</span>
  </div>
  <div class="finance-row">
    <span class="finance-label">Approved</span>
    <span class="finance-value">${esc(formatCurrency(finance.approved_amount))}</span>
  </div>
  <div class="finance-row">
    <span class="finance-label">Pending</span>
    <span class="finance-value">${esc(formatCurrency(finance.pending_amount))}</span>
  </div>
  <div class="finance-row">
    <span class="finance-label">Rejected</span>
    <span class="finance-value">${esc(formatCurrency(finance.rejected_amount))}</span>
  </div>
  <div class="finance-row">
    <span class="finance-label">Total Sponsorship</span>
    <span class="finance-value">${esc(formatCurrency(finance.total_sponsorship))}</span>
  </div>
</div>

<!-- Section 5: Take Pride Nominees -->
<h2>5 · Suggested Take Pride Nominees</h2>
<p style="color:#64748b;font-size:13px;margin:0 0 12px">
  Auto-suggested based on engagement points. Chair confirms final nominations.
</p>
<table>
  <thead>
    <tr>
      <th style="width:50px;text-align:center">#</th>
      <th>Member</th>
      <th>Rationale</th>
    </tr>
  </thead>
  <tbody>${nomineeRows}</tbody>
</table>

<div class="footer">
  <div>Generated by Yi Connect · ${esc(formatDate(generated_at))}</div>
  <div>Together We Can. We Will.</div>
</div>

</body>
</html>`;
}
