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

export function ParticipationCert({
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

  return (
    <div
      className="cert-page"
      style={{
        width: "297mm",
        height: "210mm",
        position: "relative",
        background: "#FFFDF7",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        overflow: "hidden",
        pageBreakAfter: "always",
        boxSizing: "border-box",
      }}
    >
      {/* Tricolor top border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "8px",
          background: "linear-gradient(to right, #FF9933 33%, #FFFFFF 33%, #FFFFFF 66%, #138808 66%)",
        }}
      />
      {/* Tricolor bottom border */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "8px",
          background: "linear-gradient(to right, #FF9933 33%, #FFFFFF 33%, #FFFFFF 66%, #138808 66%)",
        }}
      />
      {/* Left decorative stripe */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: 0,
          bottom: "8px",
          width: "4px",
          background: "linear-gradient(to bottom, #FF9933, #138808)",
        }}
      />
      {/* Right decorative stripe */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: 0,
          bottom: "8px",
          width: "4px",
          background: "linear-gradient(to bottom, #FF9933, #138808)",
        }}
      />

      {/* Inner border */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          right: "16px",
          bottom: "16px",
          border: "2px solid #D4A843",
          borderRadius: "4px",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          right: "20px",
          bottom: "20px",
          border: "1px solid #E8D5A0",
          borderRadius: "2px",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          padding: "32px 48px",
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
            marginBottom: "8px",
          }}
        >
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.5px" }}>
            Young Indians (Yi)
          </span>
          <span style={{ fontSize: "11px", color: "#999" }}>|</span>
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.5px" }}>
            Confederation of Indian Industry (CII)
          </span>
          <span style={{ fontSize: "11px", color: "#999" }}>|</span>
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.5px" }}>
            Thalir Thiran Iyakkam
          </span>
          <span style={{ fontSize: "11px", color: "#999" }}>|</span>
          <span style={{ fontSize: "11px", color: "#666", letterSpacing: "0.5px" }}>
            Bharat Rising
          </span>
        </div>

        {/* YIP branding */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: "bold",
            color: "#FF9933",
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
            margin: "12px 0 8px",
          }}
        >
          Certificate of Participation
        </h1>

        {/* Decorative line */}
        <div
          style={{
            width: "120px",
            height: "3px",
            background: "linear-gradient(to right, #FF9933, #D4A843, #138808)",
            margin: "8px auto 20px",
            borderRadius: "2px",
          }}
        />

        {/* Body text */}
        <p
          style={{
            fontSize: "16px",
            color: "#555",
            marginBottom: "8px",
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
            marginBottom: "16px",
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
            marginBottom: "6px",
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
            marginBottom: "6px",
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
            marginBottom: "28px",
            lineHeight: "1.6",
          }}
        >
          held at{" "}
          <strong style={{ color: "#333" }}>{venue}</strong>{" "}
          {dateText}
        </p>

        {/* Signature area */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "80%",
            marginTop: "auto",
            paddingBottom: "8px",
          }}
        >
          <div style={{ textAlign: "center", flex: 1 }}>
            <div
              style={{
                width: "160px",
                borderBottom: "1.5px solid #999",
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
                borderBottom: "1.5px solid #999",
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
