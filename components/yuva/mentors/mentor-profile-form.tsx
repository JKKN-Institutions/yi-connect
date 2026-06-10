"use client";

/**
 * Mentor profile editor (Phase 6) — react-hook-form + zod.
 * Bio, organization, expertise tags, public-visibility toggle, photo upload
 * (base64 → public `yuva-public` bucket via updateMentorProfile).
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { updateMentorProfile } from "@/app/youth-academy/actions/mentors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

const profileFormSchema = z.object({
  bio: z.string().trim().max(2000, "Bio must be under 2000 characters.").optional(),
  organization: z.string().trim().max(160, "Keep it under 160 characters.").optional(),
  isPublic: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export type MentorProfileInitial = {
  bio: string | null;
  organization: string | null;
  expertise: string[];
  isPublic: boolean;
  photoUrl: string | null;
};

export function MentorProfileForm({
  personId,
  initial,
}: {
  personId: string;
  initial: MentorProfileInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [expertise, setExpertise] = useState<string[]>(initial.expertise);
  const [tagInput, setTagInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    initial.photoUrl
  );
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoContentType, setPhotoContentType] = useState<
    "image/jpeg" | "image/png" | "image/webp" | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      bio: initial.bio ?? "",
      organization: initial.organization ?? "",
      isPublic: initial.isPublic,
    },
  });

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (tag.length > 60) {
      toast.error("Keep each expertise tag under 60 characters.");
      return;
    }
    if (expertise.length >= 12) {
      toast.error("At most 12 expertise tags.");
      return;
    }
    if (expertise.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTagInput("");
      return;
    }
    setExpertise((prev) => [...prev, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setExpertise((prev) => prev.filter((t) => t !== tag));
  };

  const handlePhotoChange = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type as (typeof ACCEPTED_PHOTO_TYPES)[number])) {
      toast.error("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Photo must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (!base64) {
        toast.error("Could not read the photo — try a different file.");
        return;
      }
      setPhotoBase64(base64);
      setPhotoContentType(file.type as "image/jpeg" | "image/png" | "image/webp");
      setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (values: ProfileFormValues) => {
    startTransition(async () => {
      const result = await updateMentorProfile({
        personId,
        bio: values.bio || undefined,
        organization: values.organization || undefined,
        expertise,
        isPublic: values.isPublic,
        ...(photoBase64 && photoContentType
          ? { photoBase64, photoContentType }
          : {}),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved.");
      setPhotoBase64(null);
      setPhotoContentType(null);
      router.refresh();
    });
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>My mentor profile</CardTitle>
        <CardDescription>
          This is what students and visitors see on program pages and the
          public Mentor YUVA Network.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Photo */}
            <div className="flex items-center gap-4">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Profile photo"
                  className="h-20 w-20 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                  <Camera className="size-6 text-slate-400" />
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_PHOTO_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  <Camera className="size-4" />
                  {photoPreview ? "Change photo" : "Upload photo"}
                </Button>
                <p className="mt-1 text-xs text-slate-500">
                  JPEG, PNG or WebP — up to 2 MB.
                </p>
              </div>
            </div>

            {/* Organization */}
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Founder, Acme Industries"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bio */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="A few lines about your background and what you bring to the cohort…"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Expertise tags */}
            <div className="space-y-2">
              <Label htmlFor="expertise-input">Expertise</Label>
              <div className="flex gap-2">
                <Input
                  id="expertise-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="e.g. Product strategy"
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addTag}
                  disabled={isPending || !tagInput.trim()}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              {expertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {expertise.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 bg-amber-50 text-amber-800 hover:bg-amber-50"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        disabled={isPending}
                        className="ml-0.5 rounded-full hover:text-amber-950"
                        aria-label={`Remove ${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Up to 12 tags — these show on your public card.
              </p>
            </div>

            {/* Public toggle */}
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel>Public profile</FormLabel>
                    <FormDescription>
                      When on, your profile is shown on the public Mentor YUVA
                      Network page.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save profile
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
