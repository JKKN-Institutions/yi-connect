import { redirect } from "next/navigation";

/**
 * Redirect /communication-hub to /communications
 * Handles legacy/external links that use the kebab-case "communication-hub" path.
 */
export default function CommunicationHubRedirect() {
  redirect("/communications");
}
