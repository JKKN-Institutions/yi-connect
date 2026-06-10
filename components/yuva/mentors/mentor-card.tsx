import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Public Mentor YUVA Network card (Phase 6).
 * Pure presentational — safe in RSCs (no client hooks). Rendered on the
 * public /youth-academy/mentors page and reusable on program detail pages
 * (Phase 8 "mentor public cards").
 */
export type MentorCardData = {
  personId: string;
  name: string;
  /** Chapters whose Mentor YUVA Network this mentor belongs to. */
  chapters: string[];
  organization: string | null;
  expertise: string[];
  bio?: string | null;
  /** Fully-resolved public URL (lib/yuva/storage publicUrl) or null. */
  photoUrl: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function MentorCard({ mentor }: { mentor: MentorCardData }) {
  return (
    <Card className="overflow-hidden border-slate-200 transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {mentor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mentor.photoUrl}
              alt={mentor.name}
              className="h-16 w-16 shrink-0 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white">
              {initials(mentor.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {mentor.name}
            </h3>
            {mentor.organization && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-600">
                <Building2 className="size-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{mentor.organization}</span>
              </p>
            )}
            {mentor.chapters.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                <MapPin className="size-3 shrink-0 text-slate-400" />
                <span className="truncate">Yi {mentor.chapters.join(" · Yi ")}</span>
              </p>
            )}
          </div>
        </div>

        {mentor.bio && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
            {mentor.bio}
          </p>
        )}

        {mentor.expertise.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mentor.expertise.slice(0, 6).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-amber-50 text-amber-800 hover:bg-amber-50"
              >
                {tag}
              </Badge>
            ))}
            {mentor.expertise.length > 6 && (
              <Badge variant="outline" className="text-slate-500">
                +{mentor.expertise.length - 6} more
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// NOTE: mentor photos use a plain <img> (not next/image) because they come
// from Supabase Storage's public bucket, whose host may not be in the
// next.config images allowlist — this keeps the public page config-free.
