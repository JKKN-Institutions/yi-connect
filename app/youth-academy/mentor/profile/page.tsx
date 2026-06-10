/**
 * Mentor profile editor page (Phase 6).
 * Mentor-self editing only (the action also allows chapter managers, but the
 * management path lives on the chapter screens). Bio, expertise, organization,
 * photo (→ public yuva-public bucket) and the is_public toggle.
 */

import { getYuvaAccess } from "@/lib/yuva/auth/yuva-access";
import { publicUrl } from "@/lib/yuva/storage";
import { createServiceClient as createYuvaService } from "@/lib/yuva/supabase/service";
import { Forbidden403 } from "@/app/youth-academy/_components/Forbidden403";
import {
  MentorProfileForm,
  type MentorProfileInitial,
} from "@/components/yuva/mentors/mentor-profile-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My mentor profile",
};

export default async function MentorProfilePage() {
  const access = await getYuvaAccess();

  // The editor is the mentor's OWN profile — staff without the mentor role
  // have nothing to edit here (they manage mentors from the chapter screens).
  if (!access.isMentor || !access.personId) {
    return (
      <Forbidden403
        reason={`Only mentor accounts have an editable profile here. ${access.reason}.`}
      />
    );
  }

  const yuva = await createYuvaService();
  const { data: profile } = await yuva
    .from("mentor_profiles")
    .select("bio, expertise, organization, photo_storage_path, is_public, updated_at")
    .eq("person_id", access.personId)
    .maybeSingle();

  const initial: MentorProfileInitial = {
    bio: profile?.bio ?? null,
    organization: profile?.organization ?? null,
    expertise: profile?.expertise ?? [],
    isPublic: profile?.is_public ?? false,
    photoUrl: profile?.photo_storage_path
      ? `${publicUrl(profile.photo_storage_path)}?v=${Date.parse(profile.updated_at) || 0}`
      : null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-amber-600 uppercase">
          Mentor YUVA Network
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Shown on program pages — and on the public Mentor YUVA Network page
          when your profile is set to public.
        </p>
      </div>

      <MentorProfileForm personId={access.personId} initial={initial} />
    </div>
  );
}
