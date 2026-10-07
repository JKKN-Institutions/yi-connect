import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CeremonyReport } from "./report-data";

/**
 * Awards ceremony report, in this app's own palette: laurel, gilt, ink.
 * Built-in PDF faces only (Times for headings, Helvetica for reading), so
 * the route never fetches a font at render time.
 */

const LAUREL = "#1f5a43";
const LAUREL_DEEP = "#12372a";
const GILT = "#b4862f";
const INK = "#13241c";
const MUTE = "#5c6e64";
const LINE = "#ccd6ce";
const VERMILION = "#c8442c";
const RANK_COLOR: Record<number, string> = { 1: GILT, 2: "#9aa3a8", 3: "#a8714a" };

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  // Line height lives on this wrapper, not the page: an inherited lineHeight makes
  // react-pdf drop the fixed footer's page-number text (seen in testing).
  flow: { fontSize: 9.5, lineHeight: 1.45 },
  rail: { flexDirection: "row", height: 5, marginBottom: 18 },
  railLaurel: { flex: 3, backgroundColor: LAUREL },
  railGilt: { flex: 1, backgroundColor: GILT },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.6, color: MUTE, textTransform: "uppercase" },
  title: { fontFamily: "Times-Roman", fontSize: 22, lineHeight: 1.25, color: LAUREL_DEEP, marginTop: 4, marginBottom: 6 },
  sub: { fontSize: 9, color: MUTE, marginTop: 4 },
  awardHead: { marginTop: 22, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: LAUREL, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  awardTitle: { fontFamily: "Times-Roman", fontSize: 15, lineHeight: 1.25, color: LAUREL_DEEP },
  pending: { fontSize: 8, color: VERMILION, borderWidth: 1, borderColor: VERMILION, borderStyle: "dashed", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  approved: { fontSize: 8, color: LAUREL, borderWidth: 1, borderColor: LAUREL, borderStyle: "dashed", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  category: { marginTop: 12, fontSize: 8, letterSpacing: 1.4, color: GILT, textTransform: "uppercase" },
  place: { marginTop: 8, paddingTop: 8, paddingLeft: 10, borderLeftWidth: 3, borderTopWidth: 0.5, borderTopColor: LINE },
  placeHead: { flexDirection: "row", justifyContent: "space-between" },
  rank: { fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: MUTE },
  chapter: { fontFamily: "Times-Roman", fontSize: 13, lineHeight: 1.25, color: INK, marginTop: 1 },
  label: { fontSize: 7.5, letterSpacing: 1.2, color: MUTE, textTransform: "uppercase", marginTop: 7, marginBottom: 2 },
  bullet: { flexDirection: "row", marginTop: 1.5 },
  dot: { width: 8, color: GILT },
  body: { flex: 1 },
  script: { marginTop: 10, padding: 8, backgroundColor: "#f4ead2" },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTE },
  empty: { marginTop: 24, fontSize: 11, color: MUTE },
});

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function CeremonyPDF({ report, includePending }: { report: CeremonyReport; includePending: boolean }) {
  const title = `Yi Recognitions · Awards ceremony ${report.cycle.name}`;
  return (
    <Document title={title} author="Yi Recognitions" creator="Yi Recognitions" producer="Yi Recognitions">
      <Page size="A4" style={s.page} wrap>
        <View style={s.footer} fixed>
          <Text>Yi Recognitions</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
        <View style={s.flow}>
        <View style={s.rail} fixed>
          <View style={s.railLaurel} />
          <View style={s.railGilt} />
          <View style={s.railLaurel} />
        </View>
        <Text style={s.eyebrow}>Take Pride · national chapter awards</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>
          Generated {DATE_FMT.format(new Date())} IST ·{" "}
          {includePending ? "Approved awards, plus awards awaiting National Leadership (marked)" : "Approved awards only"}
        </Text>
        {report.notIncluded.length > 0 ? (
          <Text style={s.sub}>
            Not in this report: {report.notIncluded.map((n) => `${n.title} (${n.why})`).join("; ")}
          </Text>
        ) : null}

        {report.awards.length === 0 ? (
          <Text style={s.empty}>No award is ready for the ceremony yet.</Text>
        ) : null}

        {report.awards.map((a) => (
          <View key={a.title}>
            <View style={s.awardHead} minPresenceAhead={80}>
              <Text style={s.awardTitle}>{a.title}</Text>
              <Text style={a.approved ? s.approved : s.pending}>{a.approved ? "Approved" : "Not yet approved"}</Text>
            </View>
            {a.places.length === 0 ? <Text style={s.sub}>The moderation has no podium places.</Text> : null}
            {a.places.map((p, i) => (
              <View key={`${p.category}-${p.rank}`} wrap={false}>
                {i === 0 || a.places[i - 1].category !== p.category ? (
                  <Text style={s.category}>{p.categoryLabel}</Text>
                ) : null}
                <View style={[s.place, { borderLeftColor: RANK_COLOR[p.rank] }]}>
                  <View style={s.placeHead}>
                    <Text style={s.rank}>
                      {p.rank} · {p.rankLabel}
                    </Text>
                    <Text style={s.rank}>{p.region}</Text>
                  </View>
                  <Text style={s.chapter}>{p.chapterName}</Text>
                  <Text style={s.label}>Key achievements</Text>
                  {p.keyAchievements.length === 0 ? <Text>—</Text> : null}
                  {p.keyAchievements.map((k, j) => (
                    <View key={j} style={s.bullet}>
                      <Text style={s.dot}>•</Text>
                      <Text style={s.body}>{k}</Text>
                    </View>
                  ))}
                  <Text style={s.label}>Citation</Text>
                  <Text>{p.citation || "—"}</Text>
                  <Text style={s.label}>Announcement</Text>
                  <Text>{p.announcement || "—"}</Text>
                </View>
              </View>
            ))}
            {a.ceremonyScript ? (
              <View style={s.script} minPresenceAhead={60}>
                <Text style={s.label}>Ceremony script</Text>
                <Text>{a.ceremonyScript}</Text>
              </View>
            ) : null}
          </View>
        ))}
        </View>
      </Page>
    </Document>
  );
}
