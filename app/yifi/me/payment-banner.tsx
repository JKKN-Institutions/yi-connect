// Small payment-status banner shown above the /yifi/me content.
//   submitted        → amber "Payment pending verification"
//   unpaid           → red   "Payment required — complete your registration"
//   verified/waived  → nothing (returns null)
// Server component (no client interactivity needed).

export function PaymentBanner({ status }: { status: string | null | undefined }) {
  if (status === "submitted") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-amber-300 text-lg leading-none">⏳</span>
        <div>
          <p className="text-amber-200 text-sm font-medium">
            Payment pending verification
          </p>
          <p className="text-amber-200/60 text-xs">
            Your organiser is confirming your payment reference. You have full access in
            the meantime.
          </p>
        </div>
      </div>
    );
  }

  if (status === "unpaid") {
    return (
      <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-red-300 text-lg leading-none">⚠️</span>
        <div>
          <p className="text-red-200 text-sm font-medium">
            Payment required — complete your registration
          </p>
          <p className="text-red-200/60 text-xs">
            Pay your YiFi fee and submit your payment reference to confirm your spot.
          </p>
        </div>
      </div>
    );
  }

  // verified / waived / unknown → nothing.
  return null;
}
