import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #FF9933 0%, #E68A2E 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "38px",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          YIP
        </span>
        <div
          style={{
            display: "flex",
            width: "100px",
            height: "3px",
            borderRadius: "2px",
            overflow: "hidden",
            marginTop: "8px",
          }}
        >
          <div style={{ flex: 1, background: "#FF9933", opacity: 0.5 }} />
          <div style={{ flex: 1, background: "white", opacity: 0.9 }} />
          <div style={{ flex: 1, background: "#138808", opacity: 0.6 }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
