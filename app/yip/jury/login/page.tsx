import { listJuryLoginEvents } from "@/app/yip/actions/auth";
import { JuryLoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function JuryLoginPage() {
  const events = await listJuryLoginEvents();
  return <JuryLoginClient events={events} />;
}
