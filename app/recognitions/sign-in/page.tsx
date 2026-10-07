import type { Metadata } from "next";
import { RibbonRail } from "../_ui/ribbon";
import { MedalMark } from "../_ui/icons";
import { ResultLine } from "../_ui/client";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** Only same-app paths are allowed as the post-sign-in destination. */
function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/recognitions") || raw.startsWith("//")) return "/recognitions";
  return raw;
}

const ERRORS: Record<string, string> = {
  unauthorized: "This email could not be signed in. Use the email your Yi account is registered under.",
  auth_failed: "Sign-in did not finish. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorText = error ? (Object.hasOwn(ERRORS, error) ? ERRORS[error] : ERRORS.auth_failed) : null;
  return (
    <>
      <RibbonRail />
      <main className="rx-main" style={{ display: "grid", placeItems: "start center", paddingTop: "8vh" }}>
        <div style={{ width: "min(420px, 100%)" }} className="rx-stack-lg">
          <div className="rx-stack" style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MedalMark size={48} />
            </div>
            <div className="rx-eyebrow">Take Pride · National chapter awards</div>
            <h1 className="rx-h1">Yi Recognitions</h1>
            <p className="rx-mute">Sign in with the email your Yi account is registered under.</p>
          </div>
          <div className="rx-plate">
            <ResultLine result={errorText ? { ok: false, text: errorText } : null} />
            <SignInForm next={safeNext(next)} devPassword={process.env.NODE_ENV === "development"} />
          </div>
        </div>
      </main>
    </>
  );
}
