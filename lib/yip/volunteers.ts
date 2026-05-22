// Shared volunteer station metadata — imported from server actions AND client UI.
// No "use server" here.

export type VolunteerStation =
  | "registration"
  | "help_desk"
  | "av_tech"
  | "room_coordinator"
  | "hospitality"
  | "stage_manager"
  | "photographer"
  | "media"
  | "runner"
  | "safety"
  | "floating";

export const VOLUNTEER_STATIONS: { code: VolunteerStation; label: string }[] = [
  { code: "registration", label: "Registration Desk" },
  { code: "help_desk", label: "Help Desk" },
  { code: "av_tech", label: "AV Tech" },
  { code: "room_coordinator", label: "Room Coordinator" },
  { code: "hospitality", label: "Hospitality" },
  { code: "stage_manager", label: "Stage Manager" },
  { code: "photographer", label: "Photographer" },
  { code: "media", label: "Media / Social" },
  { code: "runner", label: "Runner" },
  { code: "safety", label: "Safety Monitor" },
  { code: "floating", label: "Floating" },
];
