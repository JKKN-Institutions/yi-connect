"use client";

import { RegisterStep } from "./steps/register";

type ChapterMini = {
  id: string;
  name: string;
  city: string;
  state: string | null;
};

export function JoinForm({ chapters }: { chapters: ChapterMini[] }) {
  return <RegisterStep chapters={chapters} />;
}
