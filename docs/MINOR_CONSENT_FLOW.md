# Minor Consent Flow — Design Document (YIP Intake)

**Status:** Design proposal, not yet implemented
**Last updated:** 22 May 2026
**Owner:** Director, yi-connect / YIP

> [NOT LEGAL ADVICE — consult Indian DPDP-qualified counsel before publishing or implementing]

---

## 1. Why This Matters

The Young Indians Parliament (YIP) programme engages students in Classes 9 to 12, all of whom are below 18 years of age. Under **Section 9 of the Digital Personal Data Protection Act, 2023 (DPDP Act)**, a Data Fiduciary processing the personal data of a child:

- Must obtain **verifiable consent of the parent or lawful guardian** before processing
- Must not undertake processing that is likely to cause any **detrimental effect on the well-being of the child**
- Must not engage in **tracking, behavioural monitoring, or targeted advertising** directed at children

Non-compliance attracts a penalty of up to **₹200 crore** under Schedule of the DPDP Act, with a separate ceiling of **₹250 crore** for failure to take reasonable security safeguards.

YIP currently runs on the same Supabase project that hosts yi-connect. Even though yi-connect itself does not process children's data (see Section 11 of the Privacy Policy), the **shared infrastructure and shared Data Fiduciary (the Director)** creates joint regulatory exposure. A breach or non-compliance in YIP is a breach by the Director, who is also responsible for yi-connect's revenue and reputation.

This document specifies the parental consent flow that YIP must implement before the next intake cycle.

---

## 2. Current State (As-Is)

> [LEGAL REVIEW: Validate this characterisation with the YIP programme lead before circulation.]

Based on a review of the YIP intake process as of May 2026:

- Schools nominate students by submitting lists containing student name, class, school name, and **student's email address**
- Students receive an invitation directly to the email collected from the school
- Students self-register and provide their own data: name, date of birth, school, parent contact details (in some cases), areas of interest
- **No verifiable parental consent is collected before the student account is activated**
- Some chapters collect a paper consent form from parents during school visits; this is not retained in a structured, auditable repository
- There is no audit trail of consent withdrawal

This state does not meet the requirements of DPDP Section 9 and must be remediated before the 2026-27 intake cycle.

---

## 3. Required Intake Flow (To-Be)

The redesigned flow has five stages.

### Stage 1 — School Nomination (Parent Contact, Not Student Contact)

Schools submit nomination lists containing:

- Student name and class
- **Parent's email address (mandatory)**
- **Parent's mobile number (mandatory)**
- Student email — collected, but the system does **not** contact the student until consent is verified

The school principal or designated nominator countersigns the list, attesting that contact details have been collected directly from the parent or guardian.

### Stage 2 — Automated Consent Request to Parent

When the nomination list is uploaded, the system automatically:

1. Sends an email to each parent containing:
   - A plain-language explanation of YIP, what data will be collected, the purposes, retention period, and the child's rights
   - A consent form linked to a unique, time-limited token (24-hour expiry, renewable)
   - The name of the Data Fiduciary, DPO, and Grievance Officer
2. Sends an SMS to the parent's mobile with a short link to the same form, for households where email is not the primary channel

### Stage 3 — Verifiable Parental Consent

The parent completes one of three verification paths:

| Path | Mechanism | Strength |
|------|-----------|----------|
| A | E-sign of the consent form using OTP sent to parent's mobile + email | Medium |
| B | Upload of a signed PDF + selfie holding a government-issued ID (school verifies offline) | Medium |
| C | Aadhaar-based e-sign via DigiLocker or NSDL e-Sign | Strong |

> [LEGAL REVIEW: Confirm which of these methods satisfy "verifiable consent" as understood by the Data Protection Board. The DPDP Rules (draft as of 2026) are expected to clarify the standard. Until then, default to Path C where possible and Path A as fallback.]

The consent form lists the specific categories of data to be collected, the purposes, retention period, the child's rights, and the contact for withdrawal. It is **not** a generic blanket consent.

### Stage 4 — Student Activation

Only after the consent record is marked **`verified = true`**, the system:

1. Generates a unique access code for the student
2. Sends the access code to the parent (not the student directly) for forwarding
3. The student uses the code to set up their account

If consent is not received within 14 days, the nomination lapses and is purged from the system.

### Stage 5 — Ongoing Audit Trail

For each consent, the system retains:

- Consent ID (UUID)
- Parent identity (email + masked phone)
- Timestamp of consent
- IP address and user agent at the time of consent
- URL of the signed document (stored in encrypted object storage)
- Method of verification (Path A, B, or C)
- Hash of the consent form text shown to the parent (to prove what was agreed to)

---

## 4. Schema Sketch

A single table proposal, to be added in the `yi` schema:

```sql
create table yi.parental_consents (
  id uuid primary key default gen_random_uuid(),
  student_email text not null,
  student_name text not null,
  parent_email text not null,
  parent_phone text not null,
  consent_method text not null check (consent_method in ('otp_esign', 'pdf_upload', 'aadhaar_esign')),
  consent_signed_at timestamptz,
  document_url text,
  document_hash text,
  ip_address inet,
  user_agent text,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  expires_at timestamptz not null,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  audit jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_parental_consents_student_email on yi.parental_consents(student_email);
create index idx_parental_consents_parent_email on yi.parental_consents(parent_email);
create index idx_parental_consents_expires_at on yi.parental_consents(expires_at) where withdrawn_at is null;
```

Row-level security: only the YIP programme administrators and the named Grievance Officer may read this table. No chapter member or student can access it.

---

## 5. Re-Consent Triggers

A new consent must be collected when any of the following occurs:

1. The child **turns 18** — at this point the consent of the now-adult Data Principal is required directly, not the parent's. The system flags accounts approaching 18 thirty days in advance.
2. A **new YIP programme year** begins — consent for one cycle does not roll over indefinitely.
3. The **scope of data collected changes** — for example, if YIP starts collecting health information, biometric photos, or location data.
4. The **purpose changes** — for example, if data is shared with a new partner organisation.
5. **More than 12 months** have passed since the last consent, even if other triggers have not fired.

---

## 6. Withdrawal Flow

A parent may withdraw consent at any time by:

- Emailing `revoke@yip.in` [TBD — to be provisioned] from the registered parent email
- Calling the Grievance Officer on the published number

On receipt of a withdrawal request, the system:

1. Marks the consent record as `withdrawn_at = now()` within 24 hours
2. Suspends the student's account immediately
3. Within **7 calendar days**, anonymises the student's profile data: name replaced with hash, contact data deleted, event participation records stripped of identifiers, retaining only aggregate counts for reporting
4. Sends a confirmation of withdrawal to the parent
5. Logs the withdrawal in the audit trail

Data that must be retained for legal reasons (for example, financial transaction records under tax law) is moved to a restricted-access archive and not used for any other purpose.

---

## 7. Cross-Application Risk Considerations

Because yi-connect and YIP share the same Supabase project:

- A breach of the YIP `parental_consents` table is a breach of yi-connect's regulatory perimeter
- RLS policies must explicitly **deny** any cross-schema reads from yi-connect roles to YIP tables, and vice versa
- Database backups must be encrypted and access-controlled at the storage layer, not just the application layer
- The Director, as the common Data Fiduciary, must disclose both products in any breach notification

> [LEGAL REVIEW: Consider whether YIP and yi-connect should be operated under separate legal entities and separate Supabase projects before the next intake cycle, to limit cross-contamination of regulatory liability.]

---

## 8. Open Questions for Yi National + Legal Review

1. Does Yi National have an existing parental consent template that yi-connect/YIP must use, or are we free to draft our own subject to legal review?
2. What is Yi National's data retention policy for YIP alumni after they turn 18 and graduate from the programme?
3. Is YIP a "Significant Data Fiduciary" by virtue of processing children's data at scale? If yes, additional obligations under Section 10 of the DPDP Act apply (DPO appointment, Data Protection Impact Assessment, independent audit).
4. How should we handle students nominated by schools where the parent does not respond to the consent request within 14 days — is silent re-nomination in the next cycle permitted, or must the school re-nominate from scratch?
5. What is the appropriate verification standard for "verifiable parental consent" pending publication of the final DPDP Rules?
6. Should the Director hold professional indemnity insurance specifically covering child-data processing? (See `INSURANCE_QUOTE_BRIEF.md`.)
7. Is a DPIA (Data Protection Impact Assessment) required before the next YIP intake?

---

## 9. Next Steps

1. Circulate this document to Yi National programme lead and external counsel for review
2. Resolve open questions in Section 8
3. Build a small prototype of the consent flow (Stage 2 and Stage 3, Path A only) for the next school visit
4. Pilot with one school for one cohort before national rollout
5. Publish a YIP-specific privacy notice mirroring this design

---

*This document is a design proposal. No code referenced here has been written yet. Implementation is contingent on legal sign-off.*
