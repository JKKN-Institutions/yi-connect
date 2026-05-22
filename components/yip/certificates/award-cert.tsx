"use client";

import type { CertificateParticipant, CertificateEventData } from "@/app/actions/yip/certificates";
import { ROLE_LABELS } from "@/lib/yip/constants";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getLevelLabel(level: string): string {
  switch (level) {
    case "chapter":
      return "Chapter";
    case "regional":
      return "Regional";
    case "national":
      return "National";
    default:
      return level;
  }
}

export function AwardCert({
  participant,
  event,
  chairName,
}: {
  participant: CertificateParticipant;
  event: CertificateEventData;
  chairName: string;
}) {
  const roleName = participant.parliament_role
    ? ROLE_LABELS[participant.parliament_role] ?? participant.parliament_role
    : "Participant";

  const constituency = participant.constituency_name
    ? `${participant.constituency_name}${participant.constituency_state ? `, ${participant.constituency_state}` : ""}`
    : null;

  const venue = event.venue_name || event.city || "the designated venue";
  const day1 = formatDate(event.day1_date);
  const day2 = formatDate(event.day2_date);
  const sameDay = event.day1_date === event.day2_date;
  const dateText = sameDay ? `on ${day1}` : `on ${day1} & ${day2}`;

  // Split multiple awards
  const awards = participant.award_category?.split(", ") ?? [];

  return (
    <div
      className="cert-page"
      style={{
        width: "297mm",
        height: "210mm",
        position: "relative",
        background: "linear-gradient(135deg, #FFFDF7 0%, #FFF9E6 50%, #FFFDF7 100%)",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        overflow: "hidden",
        pageBreakAfter: "always",
        boxSizing: "border-box",
      }}
    >
      {/* Gold top border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "10px",
          background: "linear-gradient(to right, #B8860B, #D4A843, #FFD700, #D4A843, #B8860B)",
        }}
      />
      {/* Gold bottom border */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "10px",
          background: "linear-gradient(to right, #B8860B, #D4A843, #FFD700, #D4A843, #B8860B)",
        }}
      />
      {/* Left gold stripe */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: 0,
          bottom: "10px",
          width: "6px",
          background: "linear-gradient(to bottom, #D4A843, #FFD700, #D4A843)",
        }}
      />
      {/* Right gold stripe */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: 0,
          bottom: "10px",
          width: "6px",
          background: "linear-gradient(to bottom, #D4A843, #FFD700, #D4A843)",
        }}
      />

      {/* Inner border - gold double line */}
      <div
        style={{
          position: "absolute",
          top: "18px",
          left: "18px",
          right: "18px",
          bottom: "18px",
          border: "3px solid #D4A843",
          borderRadius: "4px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          right: "24px",
          bottom: "24px",
          border: "1px solid #E8D5A0",
          borderRadius: "2px",
        }}
      />

      {/* Corner accents (gold decorative) */}
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((corner) => {
        const isTop = corner.includes("top");
        const isLeft = corner.includes("left");
        return (
          <div
            key={corner}
            style={{
              position: "absolute",
              [isTop ? "top" : "bottom"]: "28px",
              [isLeft ? "left" : "right"]: "28px",
              width: "40px",
              height: "40px",
              borderTop: isTop ? "3px solid #B8860B" : "none",
              borderBottom: !isTop ? "3px solid #B8860B" : "none",
              borderLeft: isLeft ? "3px solid #B8860B" : "none",
              borderRight: !isLeft ? "3px solid #B8860B" : "none",
            }}
          />
        );
      })}

      {/* Content */}
      <div
        style={{
          position: "relative",
          padding: "36px 56px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        {/* Logos row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
            marginBottom: "6px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#8B7355", letterSpacing: "0.5px" }}>
            Young Indians (Yi)
          </span>
          <span style={{ fontSize: "11px", color: "#B8A080" }}>|</span>
          <span style={{ fontSize: "11px", color: "#8B7355", letterSpacing: "0.5px" }}>
            Confederation of Indian Industry (CII)
          </span>
          <span style={{ fontSize: "11px", color: "#B8A080" }}>|</span>
          <span style={{ fontSize: "11px", color: "#8B7355", letterSpacing: "0.5px" }}>
            Thalir Thiran Iyakkam
          </span>
          <span style={{ fontSize: "11px", color: "#B8A080" }}>|</span>
          <span style={{ fontSize: "11px", color: "#8B7355", letterSpacing: "0.5px" }}>
            Bharat Rising
          </span>
        </div>

        {/* YIP branding */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: "#B8860B",
            letterSpacing: "3px",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          Young Indians Parliament 2.0
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: "#1a1a1a",
            letterSpacing: "6px",
            textTransform: "uppercase",
            margin: "10px 0 6px",
          }}
        >
          Certificate of Excellence
        </h1>

        {/* Gold decorative line */}
        <div
          style={{
            width: "140px",
            height: "3px",
            background: "linear-gradient(to right, #B8860B, #FFD700, #B8860B)",
            margin: "6px auto 16px",
            borderRadius: "2px",
          }}
        />

        {/* Body text */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "6px",
            fontStyle: "italic",
          }}
        >
          This is to certify that
        </p>

        {/* Student Name */}
        <p
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: "#1a1a1a",
            marginBottom: "4px",
            lineHeight: "1.2",
          }}
        >
          {participant.full_name}
        </p>

        {/* School */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "12px",
          }}
        >
          of{" "}
          <span style={{ fontWeight: "600", color: "#333" }}>
            {participant.school_name}
          </span>
          {" "}(Class {participant.class})
        </p>

        {/* Role line */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "4px",
            lineHeight: "1.6",
          }}
        >
          participated as{" "}
          <strong style={{ color: "#1a1a1a" }}>{roleName}</strong>
          {constituency && (
            <>
              {" "}representing{" "}
              <strong style={{ color: "#1a1a1a" }}>{constituency}</strong>
            </>
          )}
        </p>

        {/* Event line */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "4px",
            lineHeight: "1.6",
          }}
        >
          in the Young Indians Parliament {getLevelLabel(event.level)} Round
        </p>

        {/* Venue and date */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "12px",
            lineHeight: "1.6",
          }}
        >
          held at{" "}
          <strong style={{ color: "#333" }}>{venue}</strong>{" "}
          {dateText}
        </p>

        {/* Award line */}
        <div
          style={{
            background: "linear-gradient(135deg, #FFF8DC, #FFEFC4, #FFF8DC)",
            border: "2px solid #D4A843",
            borderRadius: "8px",
            padding: "10px 32px",
            marginBottom: "6px",
          }}
        >
          <p
            style={{
              fontSize: "15px",
              color: "#555",
              marginBottom: "4px",
            }}
          >
            and was awarded
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#B8860B",
              lineHeight: "1.3",
            }}
          >
            {awards.join(" & ")}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "#777",
              fontStyle: "italic",
              marginTop: "2px",
            }}
          >
            for outstanding performance in parliamentary proceedings
          </p>
        </div>

        {/* Signature area */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "80%",
            marginTop: "auto",
            paddingBottom: "4px",
          }}
        >
          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              style={{
                width: "160px",
                borderBottom: "1.5px solid #B8860B",
                margin: "0 auto 6px",
              }}
            />
            <p style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>
              {chairName}
            </p>
            <p style={{ fontSize: "10px", color: "#999" }}>Chapter Chair</p>
          </div>

          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              style={{
                width: "160px",
                borderBottom: "1.5px solid #B8860B",
                margin: "0 auto 6px",
              }}
            />
            <p style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>
              Event Coordinator
            </p>
            <p style={{ fontSize: "10px", color: "#999" }}>
              Young Indians Parliament
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
