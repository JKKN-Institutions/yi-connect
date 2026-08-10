"use client";

// Slider + exact number for jury scoring (field request 2026-08-10).
//
// The NUMBER input is the real form field — it carries `name` and `required`,
// the slider carries neither. That is deliberate:
//
// A range input can never be empty; it always posts a value. Swapping the old
// `<input type="number" required>` for a bare slider would have silently
// turned "the jury has not scored this yet" into a submitted 0, and `required`
// would no longer stop a half-filled form. Keeping the number as the field
// preserves both the empty state and the browser's own validation, while the
// slider drives it for speed on a tablet.
//
// Both controls stay in sync; step matches the 0.5 half-points the team rubric
// already allowed.

import { useState } from "react";

export function ScoreSlider({
  id,
  name,
  label,
  description,
  max,
  step = 0.5,
  defaultValue,
  disabled,
  required,
}: {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  max: number;
  step?: number;
  defaultValue?: number | null;
  disabled?: boolean;
  required?: boolean;
}) {
  const [value, setValue] = useState<string>(
    defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : ""
  );

  // An untouched slider sits at 0 but must not read as a score of 0.
  const sliderPos = value === "" ? 0 : Number(value);
  const untouched = value === "";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <label htmlFor={id} className="text-sm font-bold text-navy">
          {label}
        </label>
        <span className="text-[10px] font-mono text-navy/40 shrink-0">
          {untouched ? "not scored" : `${value} / ${max}`}
        </span>
      </div>

      {description && (
        <p className="text-xs text-navy/50 mb-2">{description}</p>
      )}

      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={`${label} slider`}
          min={0}
          max={max}
          step={step}
          value={sliderPos}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          className={`flex-1 h-6 accent-[#F5A623] cursor-pointer disabled:cursor-not-allowed ${
            untouched ? "opacity-50" : ""
          }`}
        />
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="—"
          className="w-20 px-2 py-2 border border-navy/20 rounded-md text-sm text-right font-mono font-bold disabled:bg-navy/5 shrink-0"
        />
      </div>
    </div>
  );
}
