import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  FileText,
  ExternalLink,
  Quote,
} from "lucide-react";
import {
  STUDENT_FAQS,
  SAMPLE_SCRIPT,
  REFERENCE_LINKS,
} from "@/lib/yip/handbook-learn";
import { OATH_TEXT } from "@/lib/yip/constants";

export default function LearnPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div>
        <Link
          href="/yip/me"
          className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e] mb-2"
        >
          <ArrowLeft className="size-3" /> Back to My Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight flex items-center gap-2">
          <BookOpen className="size-7 text-[#FF9933]" />
          Learn YIP
        </h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1">
          Everything a participant needs — from parliamentary procedure to the oath itself.
        </p>
      </div>

      {/* Oath block */}
      <Card className="bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 border-[#FF9933]/20">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-widest text-[#FF9933] flex items-center gap-2">
            <Quote className="size-4" />
            Oath of Office
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="font-serif text-lg leading-relaxed italic text-[#1a1a3e]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {OATH_TEXT}
          </p>
          <p className="text-xs text-[#1a1a3e]/50 mt-3">
            — Constitution of India · Handbook page 44
          </p>
        </CardContent>
      </Card>

      {/* FAQs */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-5 text-[#FF9933]" />
          <h2 className="text-xl font-bold text-[#1a1a3e]">
            Student FAQs
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            Handbook p. 47–48
          </Badge>
        </div>

        <div className="space-y-2">
          {STUDENT_FAQS.map((f, i) => (
            <details
              key={i}
              className="group rounded-lg border border-[#1a1a3e]/8 bg-white hover:border-[#FF9933]/30 transition-colors"
            >
              <summary className="cursor-pointer list-none px-4 py-3 flex items-start gap-3 font-medium text-sm text-[#1a1a3e]">
                <span className="font-mono text-xs text-[#FF9933] mt-0.5 shrink-0">
                  Q{i + 1}
                </span>
                <span className="flex-1">{f.q}</span>
                <span className="text-[#1a1a3e]/40 group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </summary>
              <div className="px-4 pb-4 pl-10 text-sm text-[#1a1a3e]/75 leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Sample Script */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-[#FF9933]" />
          <h2 className="text-xl font-bold text-[#1a1a3e]">
            Sample Parliamentary Script
          </h2>
          <Badge variant="secondary" className="text-[10px]">
            Handbook p. 39–43
          </Badge>
        </div>
        <p className="text-xs text-[#1a1a3e]/60 italic">
          A walkthrough of what a real YIP session sounds like — use these as reference
          cadences, not as exact scripts. Adapt to your own voice and topic.
        </p>

        <div className="space-y-2">
          {SAMPLE_SCRIPT.map((s, i) => (
            <Card key={i} className="border-[#1a1a3e]/8">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#FF9933]">
                    {s.title}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {s.role}
                  </Badge>
                </div>
                <p className="text-sm text-[#1a1a3e] leading-relaxed italic border-l-2 border-[#FF9933]/30 pl-3">
                  {s.line}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* References */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink className="size-5 text-[#FF9933]" />
          <h2 className="text-xl font-bold text-[#1a1a3e]">Reference Sources</h2>
          <Badge variant="secondary" className="text-[10px]">
            Handbook p. 25
          </Badge>
        </div>
        <p className="text-xs text-[#1a1a3e]/60 italic">
          Stay updated with current topics of discussion and deliberation across the country.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REFERENCE_LINKS.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-[#1a1a3e]/8 bg-white p-4 hover:border-[#FF9933]/40 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-[#1a1a3e]">{r.label}</span>
                <ExternalLink className="size-3.5 text-[#FF9933] shrink-0 mt-1" />
              </div>
              <p className="text-xs text-[#1a1a3e]/60 mt-1">{r.description}</p>
              <p className="text-xs text-[#FF9933]/80 mt-2 font-mono">
                {new URL(r.url).hostname.replace("www.", "")}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* Dress + What to Carry */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[#1a1a3e]">On the Day</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#FF9933] mb-2">
                Dress Code
              </div>
              <p className="text-sm text-[#1a1a3e]">
                Formal / semi-formal Indian attire, or school uniform.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#FF9933] mb-2">
                What to Carry
              </div>
              <ul className="text-sm text-[#1a1a3e]/80 space-y-1 list-disc pl-4">
                <li>Notepad and pen</li>
                <li>Your prepared 90-second speech</li>
                <li>Clear understanding of your role, party, and topic</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
