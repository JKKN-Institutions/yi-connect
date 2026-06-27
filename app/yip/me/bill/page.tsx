import { redirect } from "next/navigation";

// The standalone bill-drafting page has been folded into the unified Committee
// Room (locked decision 2026-06-27 — single source for bill + discussion +
// amendments + roles + documents). Anyone landing here (old links, PWA tiles)
// is forwarded to the Room, which resolves their committee from their session.
export default function BillRedirect() {
  redirect("/yip/me/committee");
}
