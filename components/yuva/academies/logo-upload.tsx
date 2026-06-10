"use client";

/**
 * Academy logo upload (NATIONAL): file → base64 → uploadAcademyLogo →
 * yuva-public bucket at academies/{id}/logo.png. Per-academy combo logo
 * (youth-network + partner-institution), spec "National — academies".
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { uploadAcademyLogo } from "@/app/youth-academy/actions/academies";
import { AcademyLogo } from "./academy-card";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches the server cap

export function LogoUpload({
  academyId,
  academyName,
  currentUrl,
}: {
  academyId: string;
  academyName: string;
  currentUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (PNG / JPG / SVG).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be under 2 MB.");
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    setUploading(true);
    const result = await uploadAcademyLogo({
      academyId,
      base64,
      contentType: file.type,
    });
    setUploading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    // Cache-bust the fixed public path so the new logo shows immediately.
    setPreview(`${result.data.url}?v=${Date.now()}`);
    toast.success("Logo updated");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <AcademyLogo url={preview} name={academyName} size={64} />
      <div className="space-y-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageUp className="size-4" />
          )}
          {preview ? "Replace logo" : "Upload logo"}
        </Button>
        <p className="text-xs text-slate-400">
          Combo logo (Yi YUVA + partner institution). PNG/JPG, max 2 MB.
        </p>
      </div>
    </div>
  );
}
