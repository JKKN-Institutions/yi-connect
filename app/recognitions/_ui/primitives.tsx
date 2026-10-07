import Link from "next/link";
import type { Phase } from "@/lib/recognitions/phase";
import { isPast, PHASE_LABEL } from "@/lib/recognitions/phase";
import { IconClock, IconGate, IconLock } from "./icons";

export function Seal({
  tone = "mute",
  children,
}: {
  tone?: "laurel" | "gilt" | "vermilion" | "mute";
  children: React.ReactNode;
}) {
  return <span className={`rx-seal rx-seal-${tone}`}>{children}</span>;
}

const PHASE_TONE: Record<Phase, "laurel" | "gilt" | "vermilion" | "mute"> = {
  setup: "mute",
  nominations: "laurel",
  stage1: "laurel",
  stage2: "gilt",
  governance: "gilt",
  reevaluation: "vermilion",
  finalized: "laurel",
};

export function PhaseSeal({ phase }: { phase: Phase }) {
  return <Seal tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Seal>;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "alert" | "ok";
  children: React.ReactNode;
}) {
  const cls = tone === "alert" ? "rx-notice rx-notice-alert" : tone === "ok" ? "rx-notice rx-notice-ok" : "rx-notice";
  return <div className={cls} role={tone === "alert" ? "alert" : undefined}>{children}</div>;
}

/**
 * Every permission denial renders this — never a silent redirect.
 * `reason` is the exact sentence the gate returned.
 */
export function NoAccess({ reason, contact = true }: { reason: string; contact?: boolean }) {
  return (
    <div className="rx-narrow">
      <div className="rx-plate rx-stack" role="alert">
        <div className="rx-row" style={{ color: "var(--rx-vermilion)" }}>
          <IconLock size={22} />
          <span className="rx-eyebrow" style={{ color: "var(--rx-vermilion)" }}>No access</span>
        </div>
        <h1 className="rx-h2">You don&apos;t have access to this page</h1>
        <p>{reason}</p>
        {contact ? (
          <p className="rx-mute rx-small">
            If you should have access, ask the Recognitions super admin to add you. They can see which
            role you need.
          </p>
        ) : null}
        <div>
          <Link href="/recognitions" className="rx-btn rx-btn-quiet">
            <IconGate size={16} /> Back to your desks
          </Link>
        </div>
      </div>
    </div>
  );
}

const DATE_FMT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  return `${DATE_FMT.format(new Date(iso))} IST`;
}

export function Deadline({ label, iso }: { label: string; iso: string | null }) {
  const past = isPast(iso);
  return (
    <div className="rx-row rx-small" style={{ gap: 8 }}>
      <IconClock size={16} className="rx-mute" />
      <span className="rx-mute">{label}</span>
      <span className="rx-num" style={{ color: past ? "var(--rx-vermilion)" : "var(--rx-ink)" }}>
        {formatWhen(iso)}
        {past ? " · closed" : ""}
      </span>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="rx-steps">
      {steps.map((s, i) => (
        <li
          key={s}
          className="rx-step"
          data-state={i < current ? "done" : i === current ? "current" : "todo"}
          aria-current={i === current ? "step" : undefined}
        >
          <span className="rx-step-n">STEP {i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="rx-stack" style={{ marginBottom: 24 }}>
      {eyebrow ? <div className="rx-eyebrow">{eyebrow}</div> : null}
      <h1 className="rx-h1">{title}</h1>
      {children}
    </header>
  );
}
