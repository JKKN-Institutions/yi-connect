import Link from "next/link";
import { getRxViewer } from "@/lib/recognitions/auth";
import { BugReporterWrapper } from "@/components/bug-reporter-wrapper";
import { RibbonRail } from "../_ui/ribbon";
import { PartnerMarks } from "../_ui/icons";
import { NoAccess } from "../_ui/primitives";
import { DeskNav, SignOutButton } from "./desk-nav";
import { desksFor } from "./desks";

// Every page here depends on who is signed in.
export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getRxViewer();
  return (
    <>
      <RibbonRail />
      <header className="rx-top">
        <div className="rx-top-inner">
          <Link href="/recognitions" className="rx-mark">
            <PartnerMarks />
            <span className="rx-mark-rule" aria-hidden="true" />
            <span className="rx-mark-word">Yi Recognitions &amp; Celebrations</span>
          </Link>
          {viewer ? <DeskNav desks={desksFor(viewer)} /> : null}
          <div className="rx-who">
            {viewer?.email ? <span>{viewer.email}</span> : null}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="rx-main">
        {viewer ? (
          // Bug-report button (JKKN Bug Reporter SDK) for signed-in Recognitions
          // users only: no viewer, no wrapper. The directory carries no display
          // name, so the wrapper falls back to the email prefix.
          <BugReporterWrapper userProfile={{ id: viewer.userId, email: viewer.email, full_name: null }}>
            {children}
          </BugReporterWrapper>
        ) : (
          <NoAccess reason="You are signed in, but your account is not in the Yi directory, so Recognitions can't tell which chapter or role is yours." />
        )}
      </main>
    </>
  );
}
