import { redirect } from "next/navigation";

/**
 * Redirect /communication to /communications
 * This handles the common typo where users omit the 's'
 */
export default function CommunicationRedirect() {
  redirect("/communications");
}
