import { ImageResponse } from "next/og";
import { getDelegateContext } from "@/app/yi-future/actions/gamification";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ctx = await getDelegateContext(id);
  if (!ctx) {
    return new Response("Not found", { status: 404 });
  }

  const trackColor = ctx.track_color ?? "#F5A623";
  const first = ctx.full_name.split(" ")[0] ?? ctx.full_name;
  const trackName = ctx.track_name ?? "change";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FEFCF6",
          fontFamily: "system-ui",
          color: "#1a1a3e",
        }}
      >
        {/* Top gradient bar */}
        <div
          style={{
            display: "flex",
            height: 12,
            width: "100%",
            background: `linear-gradient(90deg, ${trackColor}, #1a1a3e)`,
          }}
        />

        {/* Header strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "32px 60px 0",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 4,
                color: "#F5A623",
                textTransform: "uppercase",
              }}
            >
              Yi YUVA · CII
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 800,
                marginTop: 4,
                color: "#1a1a3e",
              }}
            >
              Future 6.0
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#6b6b80",
            }}
          >
            2026 Edition
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "30px 60px 30px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 600,
              color: "#6b6b80",
            }}
          >
            I just joined Future 6.0.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
              marginTop: 24,
              color: "#1a1a3e",
            }}
          >
            I&apos;m in for
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
              marginTop: 8,
              color: trackColor,
            }}
          >
            {trackName}.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              gap: 56,
            }}
          >
            <Stat label="Delegate" value={first} color="#1a1a3e" />
            <Stat
              label="Chapter"
              value={ctx.chapter_name ?? "India"}
              color="#1a1a3e"
            />
            <Stat
              label="Delegate #"
              value={`#${ctx.serial_in_edition}`}
              color={trackColor}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px 60px",
            background: "#1a1a3e",
            color: "#FEFCF6",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex" }}>
            90 days. 4 tracks. One shot at real impact.
          </div>
          <div style={{ display: "flex", color: "#F5A623" }}>
            yi-connect-app.vercel.app/yi-future
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 3,
          color: "#6b6b80",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 36,
          fontWeight: 800,
          marginTop: 4,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}
