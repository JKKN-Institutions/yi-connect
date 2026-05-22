import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "108px",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 200,
            fontWeight: 800,
            letterSpacing: "-4px",
            lineHeight: 1,
          }}
        >
          YIP
        </span>
        <div
          style={{
            display: "flex",
            width: "280px",
            height: "6px",
            borderRadius: "3px",
            overflow: "hidden",
            marginTop: "20px",
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
