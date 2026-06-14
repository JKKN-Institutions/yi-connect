import { redirect } from "next/navigation";

/**
 * /home is retired — the app entry is now /hub (login when signed out, a
 * role-scoped module hub when signed in). Kept as a redirect so installed PWAs,
 * old bookmarks, and any in-flight links still land in the right place.
 */
export default function HomeRedirect() {
  redirect("/hub");
}
