"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { YearOption } from "@/app/yi-future/actions/chapter-chairs";

interface Props {
  years: YearOption[];
  selected: number;
}

export function YearSelector({ years, selected }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    next.set("year", e.target.value);
    router.push(`?${next.toString()}`);
  }

  return (
    <label className="text-xs text-navy/70 flex items-center gap-2">
      <span>Year</span>
      <select
        value={selected}
        onChange={handleChange}
        className="rounded-md border border-navy/15 bg-white px-2 py-1.5 text-sm font-medium text-navy"
      >
        {years.map((y) => (
          <option key={y.edition_id} value={y.year}>
            {y.year}
            {y.is_active ? " · active" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
