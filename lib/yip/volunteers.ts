// Shared volunteer station metadata — imported from server actions AND client UI.
// No "use server" here.

export type VolunteerStation =
  | "registration"
  | "help_desk"
  | "av_tech"
  | "room_coordinator"
  | "hospitality"
  | "stage_manager"
  | "speaker_desk"
  | "photographer"
  | "media"
  | "runner"
  | "safety"
  | "floating"
  | "jury_support"
  | "organiser_helper";

export const VOLUNTEER_STATIONS: { code: VolunteerStation; label: string }[] = [
  { code: "registration", label: "Registration Desk" },
  { code: "help_desk", label: "Help Desk" },
  { code: "jury_support", label: "Jury Support" },
  { code: "av_tech", label: "AV Tech" },
  { code: "room_coordinator", label: "Room Coordinator" },
  { code: "hospitality", label: "Hospitality" },
  { code: "stage_manager", label: "Stage Manager" },
  { code: "speaker_desk", label: "Now Speaking (Speaker's aide)" },
  { code: "photographer", label: "Photographer" },
  { code: "media", label: "Media / Social" },
  { code: "runner", label: "Runner" },
  { code: "organiser_helper", label: "Organiser Helper" },
  { code: "safety", label: "Safety Monitor" },
  { code: "floating", label: "Floating" },
];

// Stations that have a dedicated self-service tool in the volunteer kiosk.
// Any other station (av_tech, photographer, …) gets the generic station screen.
export const STATIONS_WITH_TOOLS: VolunteerStation[] = [
  "registration",
  "help_desk",
  "jury_support",
  "runner",
  "organiser_helper",
];
