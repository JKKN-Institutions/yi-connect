import Link from "next/link";
import { getRxViewer } from "@/lib/recognitions/auth";
import { RibbonRail } from "../_ui/ribbon";
import { MedalMark } from "../_ui/icons";
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
            <MedalMark />
            <span className="rx-mark-word">Yi Recognitions</span>
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
          children
        ) : (
          <NoAccess reason="You are signed in, but your account is not in the Yi directory, so Recognitions can't tell which chapter or role is yours." />
        )}
      </main>
    </>
  );
}
