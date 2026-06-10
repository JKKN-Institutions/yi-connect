"use client";

/**
 * Session material upload (Phase 11) — title + file → base64 →
 * uploadMaterial (gated mentor-of-session OR manager). 6 MB cap mirrors the
 * server-side guard.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { uploadMaterial } from "@/app/youth-academy/actions/materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6 MB (server caps base64 at ~8M chars)

const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function MaterialUpload({ runSessionId }: { runSessionId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload() {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is too large — 6 MB max.");
      return;
    }
    const finalTitle = title.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadMaterial(runSessionId, {
        title: finalTitle,
        base64,
        contentType: file.type || "application/octet-stream",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Material uploaded.");
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor={`material-title-${runSessionId}`}>Title</Label>
        <Input
          id={`material-title-${runSessionId}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Session slides"
          maxLength={160}
          disabled={uploading}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`material-file-${runSessionId}`}>File</Label>
        <Input
          id={`material-file-${runSessionId}`}
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-slate-500">
          PDF, Word, PowerPoint, Excel, image or ZIP — 6 MB max.
        </p>
      </div>
      <Button
        type="button"
        onClick={onUpload}
        disabled={uploading || !file}
        className="bg-slate-900 hover:bg-slate-800"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Upload
      </Button>
    </div>
  );
}
