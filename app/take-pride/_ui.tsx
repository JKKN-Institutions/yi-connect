import Link from "next/link";

const SHIFT = ["#4fb3dc", "#1f5a8a", "#0e7a3c", "#9cc93b", "#9b2a2f", "#d81f3a", "#f2a93b", "#e07b1f", "#8f9196"];

export function ShiftMark() {
  return (
    <span className="tp-shift" aria-hidden="true">
      {SHIFT.map((c) => (
        <i key={c} style={{ background: c }} />
      ))}
    </span>
  );
}

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="tp-top">
      <Link href="/take-pride" className="tp-brand">
        <ShiftMark />
        <b>
          TAKE<span>PRIDE</span>&rsquo;26
        </b>
      </Link>
      {right}
    </header>
  );
}

export function SampleNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="tp-sample">
      {children ??
        "Sample delegates: the real Take Pride list is on myCII and will replace these before the event."}
    </p>
  );
}

export function Denied({ title, text }: { title: string; text: string }) {
  return (
    <main className="tp-main">
      <TopBar />
      <div className="tp-card">
        <h1 className="tp-h2">{title}</h1>
        <p className="tp-mute" style={{ margin: 0 }}>{text}</p>
      </div>
    </main>
  );
}
