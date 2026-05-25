"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCensus } from "@/app/yifi/actions/census";

interface CensusPromptProps {
  registrant: {
    id: string;
    sector: string | null;
    organisation: string | null;
    designation: string | null;
    city: string | null;
    challenges: string[] | null;
  };
}

export function CensusPrompt({ registrant }: CensusPromptProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  if (!isOpen) return null;

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateCensus(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-[#FD7215]/10 border border-[#FD7215]/30 rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Complete Your Census</h3>
          <p className="text-white/50 text-sm mt-1">
            This powers your personalised matches and dossier. Takes 2 minutes.
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            name="sector"
            placeholder="Your industry / sector"
            defaultValue={registrant.sector ?? ""}
            required
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          />
          <input
            name="organisation"
            placeholder="Organisation name"
            defaultValue={registrant.organisation ?? ""}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          />
          <input
            name="designation"
            placeholder="Your role / designation"
            defaultValue={registrant.designation ?? ""}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          />
          <input
            name="city"
            placeholder="City"
            defaultValue={registrant.city ?? ""}
            className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
          />
        </div>

        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
            Top 3 business challenges right now
          </label>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                name={`challenge${i + 1}`}
                placeholder={`Challenge ${i + 1}${i === 0 ? " (required)" : ""}`}
                defaultValue={registrant.challenges?.[i] ?? ""}
                required={i === 0}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-white/60 text-xs uppercase tracking-wide mb-2 block">
            What can you offer other founders? (optional)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              name="offer_capital"
              placeholder="Capital range (e.g. ₹5L-50L)"
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
            />
            <input
              name="offer_hours"
              placeholder="Hours/month you can mentor"
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
            />
            <input
              name="offer_distribution"
              placeholder="Distribution reach"
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
            />
            <input
              name="offer_customers"
              placeholder="Customer access / intro"
              className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:ring-2 focus:ring-[#FD7215] focus:border-transparent"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Census"}
        </button>
      </form>
    </div>
  );
}
