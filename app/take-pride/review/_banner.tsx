import { reviewSignOut } from "./actions";

/** Slim strip shown on desk pages while a review session is active. */
export function ReviewBanner() {
  return (
    <form
      action={reviewSignOut}
      className="tp-sample"
      role="status"
      data-testid="review-banner"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: 0, fontWeight: 600 }}
    >
      <span>Review mode · sample data only</span>
      <button
        type="submit"
        data-testid="review-signout"
        style={{ appearance: "none", border: 0, background: "none", color: "inherit", font: "inherit", textDecoration: "underline", cursor: "pointer", padding: "6px 0", minHeight: 32 }}
      >
        Sign out
      </button>
    </form>
  );
}

/** Shown where review mode reaches something it may not use. */
export function NotInReview({ what }: { what: string }) {
  return (
    <p className="tp-alert warn" style={{ margin: 0 }} data-testid="not-in-review">
      {what}: not available in review mode.
    </p>
  );
}
