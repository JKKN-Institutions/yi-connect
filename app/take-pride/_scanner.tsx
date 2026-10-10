"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

/**
 * Camera scanner that STAYS ON between scans, for a gate or a partner booth
 * where badges come one after another. Callers de-duplicate repeats.
 * (The shared components/mobile/qr-scanner stops after every scan.)
 */
export function ContinuousScanner({ onScan }: { onScan: (text: string) => void }) {
  const id = "tp-scan-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<Html5Qrcode | null>(null);
  const cb = useRef(onScan);
  cb.current = onScan;
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setErr(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      ref.current ??= new Html5Qrcode(id);
      await ref.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
        (text) => {
          try { navigator.vibrate?.(60); } catch { /* not supported */ }
          cb.current(text);
        },
        () => {}
      );
      setOn(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Camera could not start. Allow camera access, or type the code below.");
      setOn(false);
    }
  }

  async function stop() {
    try { if (ref.current?.isScanning) await ref.current.stop(); } catch { /* already stopped */ }
    setOn(false);
  }

  useEffect(() => () => { void (async () => { try { if (ref.current?.isScanning) await ref.current.stop(); ref.current?.clear(); } catch { /* unmounting */ } })(); }, []);

  return (
    <div className="tp-stack" style={{ gap: 8 }}>
      <div id={id} style={{ width: "100%", maxWidth: 360, margin: "0 auto", borderRadius: 12, overflow: "hidden", background: on ? "#000" : "transparent" }} />
      <button type="button" className={`tp-btn block ${on ? "ghost" : "green"}`} onClick={on ? stop : start}>
        {on ? "Stop camera" : "Start camera scanner"}
      </button>
      {on && <p className="tp-small" style={{ margin: 0, textAlign: "center" }}>Camera stays on. Point it at each badge in turn.</p>}
      {err && <p className="tp-alert bad" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
