#!/usr/bin/env node
// Relink pass: populate approved_email_id and created_member_id by email match
import { readFileSync } from "fs";
import { resolve } from "path";

const PROJECT_ROOT = "/Users/omm/PROJECTS/yi-connect";
function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(resolve(PROJECT_ROOT, path), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const NEW = loadEnv(".env.local");
const URL = NEW.NEXT_PUBLIC_SUPABASE_URL;
const KEY = NEW.SUPABASE_SERVICE_ROLE_KEY;

async function get(path, schema = "yi_connect") {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": schema },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patch(table, idCol, idVal, body, schema = "yi_connect") {
  const res = await fetch(`${URL}/rest/v1/${table}?${idCol}=eq.${idVal}`, {
    method: "PATCH",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Content-Profile": schema,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? null : await res.text() };
}

async function main() {
  console.log("=== RELINK PASS ===");
  // 1. Fetch all profiles + approved_emails + members
  const profiles = await get("profiles?select=id,email,approved_email_id");
  const approvedEmails = await get("approved_emails?select=id,email,created_member_id");
  const members = await get("members?select=id"); // members.id IS profiles.id
  console.log(`  profiles: ${profiles.length}, approved_emails: ${approvedEmails.length}, members: ${members.length}`);

  // Build maps
  const emailToApprovedEmail = new Map(approvedEmails.map((a) => [(a.email || "").toLowerCase(), a]));
  const memberIds = new Set(members.map((m) => m.id));

  // 2. Update profiles where approved_email_id is null but a matching approved_emails row exists
  let profileUpdates = 0;
  let profileErrors = 0;
  for (const p of profiles) {
    if (p.approved_email_id) continue; // already linked
    const ae = emailToApprovedEmail.get((p.email || "").toLowerCase());
    if (!ae) continue;
    const r = await patch("profiles", "id", p.id, { approved_email_id: ae.id });
    if (r.ok) profileUpdates++;
    else { profileErrors++; if (profileErrors <= 3) console.log(`    profile ${p.email}: ${r.status} ${r.body?.slice(0, 100)}`); }
  }
  console.log(`  profiles.approved_email_id linked: ${profileUpdates}, errors: ${profileErrors}`);

  // 3. Update approved_emails where created_member_id is null but a matching profile/member exists by email
  // First build profile email → profile.id map (member.id = profile.id)
  const emailToProfile = new Map(profiles.map((p) => [(p.email || "").toLowerCase(), p]));
  let aeUpdates = 0;
  let aeErrors = 0;
  for (const ae of approvedEmails) {
    if (ae.created_member_id) continue;
    const profile = emailToProfile.get((ae.email || "").toLowerCase());
    if (!profile || !memberIds.has(profile.id)) continue;
    const r = await patch("approved_emails", "id", ae.id, { created_member_id: profile.id });
    if (r.ok) aeUpdates++;
    else { aeErrors++; if (aeErrors <= 3) console.log(`    ae ${ae.email}: ${r.status} ${r.body?.slice(0, 100)}`); }
  }
  console.log(`  approved_emails.created_member_id linked: ${aeUpdates}, errors: ${aeErrors}`);

  console.log("=== DONE ===");
}
main().catch(console.error);
