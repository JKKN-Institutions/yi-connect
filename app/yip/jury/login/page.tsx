import { redirect } from "next/navigation";

// The jury email-login door was removed (2026-07-03): every juror is provisioned
// with an access code and signs in at /yip/join (which checks jury_assignments
// too). This route is kept only so any bookmarked / printed "/yip/jury/login"
// link lands on the code login instead of a 404.
export default function JuryLoginRedirect() {
  redirect("/yip/join");
}
