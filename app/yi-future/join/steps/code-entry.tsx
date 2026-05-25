import { useState, useTransition, useEffect, useRef } from "react";
import { validateAccessCode } from "@/app/yi-future/actions/auth";

export function CodeEntryStep({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: (redirect: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, "")
      .slice(0, 6);
    setCode(cleaned);
    if (error) setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await validateAccessCode(code);
      if (res.ok) {
        // Tiny nav-tactile effect via vibration (supported on most Androids)
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(30);
          } catch {
            /* no-op */
          }
        }
        onSuccess(res.redirect);
      } else {
        setError(res.error);
        // Shake by re-triggering animation
        inputRef.current?.classList.remove("animate-shake");
        // Force reflow then re-add
        void inputRef.current?.offsetWidth;
        inputRef.current?.classList.add("animate-shake");
      }
    });
  }

  // Render 6 individual-looking slots by overlaying the input with boxes
  const slots = Array.from({ length: 6 }, (_, i) => code[i] ?? "");

  return (
    <div className="max-w-lg mx-auto px-4 py-10 md:py-16">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-navy/60 hover:text-navy mb-6 min-h-[44px] py-2 px-3 inline-flex items-center"
      >
        ← Back
      </button>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-navy/5 text-navy text-[11px] font-semibold tracking-wider uppercase mb-4">
          <span>⌁</span> Your passport to Future 6.0
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-navy tracking-tight">
          Enter your 6-character code
        </h1>
        <p className="mt-3 text-sm text-navy/60 leading-relaxed max-w-sm mx-auto">
          Your chapter admin shared this with you. Codes are case-insensitive and
          never contain 0, O, 1 or I.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10">
        {/* Slot display */}
        <div className="relative">
        <div
          className="flex justify-center gap-1.5 md:gap-3 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {slots.map((ch, i) => (
            <div
              key={i}
              className={`w-10 h-14 md:w-14 md:h-20 rounded-lg border-2 flex items-center justify-center text-2xl md:text-4xl font-mono font-bold transition-all ${
                ch
                  ? "border-yi-gold bg-yi-gold/5 text-navy scale-[1.02]"
                  : i === code.length
                    ? "border-navy/40 bg-white"
                    : "border-navy/10 bg-white text-navy/20"
              }`}
            >
              {ch || (i === code.length ? <BlinkingCaret /> : "·")}
            </div>
          ))}
        </div>

        <input
          ref={inputRef}
          id="access-code"
          type="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          value={code}
          onChange={handleChange}
          maxLength={6}
          aria-label="Access code"
          className="absolute inset-0 w-full h-full opacity-0 cursor-text"
          style={{ caretColor: "transparent" }}
        />
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="mt-4 text-xs text-navy/40 w-full text-center hover:text-navy/70"
        >
          Tap here if the keyboard didn&apos;t open
        </button>

        {error && (
          <div className="mt-5 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={code.length !== 6 || pending}
          className="mt-8 w-full py-4 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed text-base"
        >
          {pending ? "Unlocking…" : code.length === 6 ? "Unlock Future 6.0 →" : "Continue"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-navy/50">
          Don&apos;t have a code yet?{" "}
          <button
            type="button"
            onClick={onBack}
            className="font-semibold text-navy hover:text-yi-gold"
          >
            Take the track quiz →
          </button>
        </p>
      </div>
    </div>
  );
}

function BlinkingCaret() {
  return (
    <span className="inline-block w-0.5 h-6 md:h-12 bg-navy animate-pulse" />
  );
}
