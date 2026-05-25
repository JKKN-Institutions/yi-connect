#!/usr/bin/env node
/**
 * Provision Yi Future chapter chairs into yi_connect schema.
 *
 * Reads yi_directory.people + future.chapter_core_team,
 * creates yi_connect.approved_emails + profiles + members + user_roles.
 * Idempotent — skips existing records.
 */

const SUPABASE_URL = "https://bkmpbcoxbjyafieabxao.supabase.co";
const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbXBiY294Ymp5YWZpZWFieGFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDk1NDYyNCwiZXhwIjoyMDkwNTMwNjI0fQ.hf5VMEyxsqvnVLfOjch-Bk1y1fz3qx_3ixx6jGwa5is";
const CHAIR_ROLE_ID = "00000000-0000-0000-0000-000000000040";
const ADMIN_USER_ID = "3e3c6a65-85df-426c-b7ab-1c8eed41cffb";

const headers = {
  apikey: SVC_KEY,
  Authorization: `Bearer ${SVC_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, schema, opts = {}) {
  const h = { ...headers, "Accept-Profile": schema };
  if (opts.method === "POST" || opts.method === "PATCH") {
    h["Content-Profile"] = schema;
    h["Prefer"] = "return=representation,resolution=ignore-duplicates";
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts, headers: h });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log("1. Fetching yi_directory.people...");
  const people = await rest("people?select=id,user_id,full_name,email,phone&user_id=not.is.null", "yi_directory");
  console.log(`   Found ${people.length} people with user_id`);

  console.log("2. Fetching future.chapter_core_team...");
  const coreTeam = await rest("chapter_core_team?select=user_id,chapter_id", "future");
  const userChapter = Object.fromEntries(coreTeam.map(ct => [ct.user_id, ct.chapter_id]));
  console.log(`   Found ${coreTeam.length} core team entries`);

  console.log("3. Checking existing yi_connect records...");
  const existingProfiles = await rest("profiles?select=id,email", "yi_connect");
  const existingIds = new Set((existingProfiles || []).map(p => p.id));
  const existingEmails = new Set((existingProfiles || []).map(p => p.email));
  const existingApproved = await rest("approved_emails?select=email", "yi_connect");
  const approvedEmails = new Set((existingApproved || []).map(a => a.email));
  const existingRoles = await rest("user_roles?select=user_id&role_id=eq.00000000-0000-0000-0000-000000000040", "yi_connect");
  const existingRoleUsers = new Set((existingRoles || []).map(r => r.user_id));
  console.log(`   ${existingIds.size} profiles, ${approvedEmails.size} approved, ${existingRoleUsers.size} chair roles exist`);

  const toProvision = people.filter(p =>
    userChapter[p.user_id] && !existingIds.has(p.user_id) && !existingEmails.has(p.email)
  );
  console.log(`   ${toProvision.length} chairs to provision`);

  if (toProvision.length === 0) {
    console.log("Nothing to do — all chairs already provisioned.");
    return;
  }

  // Step 1: approved_emails (only for emails not already approved)
  console.log("4. Creating approved_emails...");
  const newApprovedEmails = toProvision.filter(p => !approvedEmails.has(p.email)).map(p => ({
    email: p.email,
    approved_by: ADMIN_USER_ID,
    assigned_chapter_id: userChapter[p.user_id],
    is_active: true,
    member_created: true,
  }));
  const aeResult = newApprovedEmails.length > 0 ? await rest("approved_emails", "yi_connect", {
    method: "POST",
    body: JSON.stringify(newApprovedEmails),
  }) : [];
  const aeCount = Array.isArray(aeResult) ? aeResult.length : 0;
  console.log(`   ${aeCount} approved_emails created`);

  // Step 2: profiles
  console.log("5. Creating profiles...");
  const profiles = toProvision.map(p => ({
    id: p.user_id,
    email: p.email,
    full_name: p.full_name,
    phone: p.phone,
    chapter_id: userChapter[p.user_id],
    person_id: p.id,
  }));
  const pResult = await rest("profiles", "yi_connect", {
    method: "POST",
    body: JSON.stringify(profiles),
  });
  const pCount = Array.isArray(pResult) ? pResult.length : 0;
  console.log(`   ${pCount} profiles created`);
  if (!Array.isArray(pResult)) console.log("   Error:", JSON.stringify(pResult).slice(0, 200));

  // Step 3: members
  console.log("6. Creating members...");
  const members = toProvision.map(p => ({
    id: p.user_id,
    chapter_id: userChapter[p.user_id],
    membership_status: "active",
    is_active: true,
  }));
  const mResult = await rest("members", "yi_connect", {
    method: "POST",
    body: JSON.stringify(members),
  });
  const mCount = Array.isArray(mResult) ? mResult.length : 0;
  console.log(`   ${mCount} members created`);
  if (!Array.isArray(mResult)) console.log("   Error:", JSON.stringify(mResult).slice(0, 200));

  // Step 4: user_roles (Chair) — for ALL people missing the Chair role, not just newly provisioned
  console.log("7. Assigning Chair role...");
  const allChairCandidates = people.filter(p => userChapter[p.user_id] && !existingRoleUsers.has(p.user_id));
  const roles = allChairCandidates.map(p => ({
    user_id: p.user_id,
    role_id: CHAIR_ROLE_ID,
  }));
  const rResult = await rest("user_roles", "yi_connect", {
    method: "POST",
    body: JSON.stringify(roles),
  });
  const rCount = Array.isArray(rResult) ? rResult.length : 0;
  console.log(`   ${rCount} Chair roles assigned`);
  if (!Array.isArray(rResult)) console.log("   Error:", JSON.stringify(rResult).slice(0, 200));

  console.log("\nDone! Summary:");
  console.log(`  approved_emails: ${aeCount}`);
  console.log(`  profiles: ${pCount}`);
  console.log(`  members: ${mCount}`);
  console.log(`  user_roles: ${rCount}`);
}

main().catch(console.error);
