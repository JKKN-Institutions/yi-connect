# Privacy Policy — yi-connect

**Last updated:** 22 May 2026
**Effective date:** [TBD — confirm on publication]

> [NOT LEGAL ADVICE — consult Indian DPDP-qualified counsel before publishing]

---

## 1. Who We Are

yi-connect ("the Platform", "we", "us") is a chapter management application operated by **Omm Sharravana**, trading as a sole proprietorship, with a registered place of business at:

[Address Line — TBD], Erode, Tamil Nadu, India

For the purposes of the **Digital Personal Data Protection Act, 2023** (DPDP Act), Omm Sharravana is the **Data Fiduciary** in respect of personal data processed through yi-connect.

The Platform is used by Yi (Young Indians) chapters — a wing of the Confederation of Indian Industry (CII) — to manage chapter members, events, finances, and chapter-to-national communication.

---

## 2. Scope of This Policy

This policy applies to personal data collected and processed through the yi-connect web application and its supporting services. It does **not** cover:

- The Yi National platforms operated by CII
- The Young Indians Parliament (YIP) intake system, which has its own consent flow (see Section 11)
- Third-party services Yi members independently use (e.g., WhatsApp, LinkedIn)

---

## 3. Personal Data We Collect

We collect the following categories of personal data from adult chapter members:

| Category | Examples |
|----------|----------|
| Identity data | Full name, date of birth, gender |
| Contact data | Email address, mobile number, postal address |
| Professional data | Job title, company, industry, areas of expertise |
| Membership data | Chapter, joining date, role, vertical, designation |
| Event data | Events attended, RSVPs, volunteer assignments |
| Financial data | Membership fees paid, sponsorship contributions, reimbursements |
| Visual data | Photographs taken at chapter events (group and individual) |
| Engagement data | Login times, modules accessed, content viewed |

We do **not** knowingly collect Aadhaar numbers, PAN, bank account credentials, or government-issued ID numbers through yi-connect. If chapter administrators upload such information, they must remove it.

---

## 4. Purposes of Collection (Lawful Purposes under DPDP Section 4)

We collect and process personal data for the following stated, lawful purposes:

1. Operating chapter membership records, including onboarding, renewals, and exits
2. Coordinating chapter events, including RSVPs, venue logistics, and volunteer assignments
3. Tracking chapter finances, sponsorships, and reimbursement workflows
4. Enabling member-to-member collaboration within a chapter and across Yi chapters
5. Reporting chapter performance to Yi National in line with Yi's national policies
6. Communicating chapter announcements, newsletters, and event invitations
7. Recognising members through the Take Pride awards and leadership pipelines
8. Complying with applicable legal, audit, and accreditation obligations

Personal data will **not** be used for advertising, sold to third parties, or used to train external AI models.

---

## 5. Legal Basis for Processing

Under the DPDP Act, personal data may be processed only on the basis of **consent** or for **certain legitimate uses** defined in Section 7.

We rely on:

- **Consent (DPDP Section 6):** For collecting member profile data, professional details, photographs, and communication preferences. Consent is obtained at the point of membership onboarding through a clear, specific, and informed notice. Members may withdraw consent at any time (see Section 7).
- **Legitimate use — performance of a contract / membership obligation (Section 7):** For processing data strictly necessary to operate a member's chapter membership, including attendance records and financial obligations toward the chapter.
- **Legitimate use — compliance with law:** Where retention or disclosure is required by an Indian regulator, court, or tax authority.

We do not rely on "legitimate interest" as a standalone basis, because the DPDP Act does not recognise that ground in the form used under the EU GDPR.

---

## 6. Data Fiduciary Identity and Contacts

| Role | Person | Contact |
|------|--------|---------|
| Data Fiduciary | Omm Sharravana (sole proprietor) | director@jkkn.ac.in [TBD — replace with dedicated address] |
| Data Protection Officer | Omm Sharravana (interim) | dpo@yi-connect.in [TBD — to be provisioned] |
| Grievance Officer | Omm Sharravana (interim) | grievance@yi-connect.in [TBD — to be provisioned] |

Once the Platform crosses the Significant Data Fiduciary threshold or incorporates as a private limited company, separate DPO and Grievance Officer roles will be appointed.

---

## 7. Rights of Data Principals

Under the DPDP Act, Sections 11 to 14, every individual (Data Principal) whose data is processed by yi-connect has the following rights:

1. **Right to information** about personal data processed, its categories, and the purposes of processing
2. **Right to access** a copy of personal data held about them
3. **Right to correction** of inaccurate or misleading data and **erasure** of data no longer required
4. **Right to grievance redressal** by writing to the Grievance Officer; we will respond within **30 calendar days**
5. **Right to nominate** another individual to exercise these rights in the event of death or incapacity
6. **Right to withdraw consent** at any time, with effect from the date of withdrawal (Section 6(4))

To exercise any of these rights, write to grievance@yi-connect.in [TBD] with your full name, chapter, and the specific request. We may ask for reasonable verification before acting on the request.

If you are dissatisfied with our response, you may approach the **Data Protection Board of India** under Section 27 of the DPDP Act.

---

## 8. Retention

We retain personal data for the longer of:

- **Five (5) years** after the end of an individual's chapter membership, OR
- The retention period mandated by Yi's national policies

After this period, personal data is deleted or anonymised, except where retention is required by law (for example, financial records under the Income Tax Act, 1961, which mandates a minimum of 6 years for certain books of account).

Photographs taken at public chapter events may be retained indefinitely for historical and archival purposes, in line with standard practice for chapter records. Members may request removal of specific photographs.

---

## 9. Security Measures

We implement the following technical and organisational safeguards under Section 8(5) of the DPDP Act:

- **Encryption at rest:** All personal data stored in the Supabase Postgres database is encrypted using AES-256
- **Encryption in transit:** TLS 1.2 or higher for all connections between the user's browser and our servers
- **Role-based access control:** Members see only the data for their chapter; chapter chairs see only their chapter; national-level roles see aggregated data
- **Row-level security (RLS):** Enforced at the database layer through Supabase RLS policies
- **No plaintext credentials:** Passwords are hashed using bcrypt; API keys are stored as environment secrets
- **Daily backups:** Automated daily backups of the database, retained for 30 days
- **Audit logging:** Material actions (member edits, financial transactions, exports) are logged with user identity and timestamp

Despite these measures, no system is fully immune to compromise. In the event of a personal data breach, we will notify the Data Protection Board and affected Data Principals as required under Section 8(6) of the DPDP Act.

---

## 10. Cross-Border Transfers

yi-connect is hosted on **Supabase**, whose primary infrastructure is located in the **United States of America**. As a result, personal data collected through yi-connect is transferred to and stored in the United States.

By using yi-connect, members consent to this transfer. The Government of India has not, as of the date of this policy, restricted transfers to the United States under Section 16 of the DPDP Act. We will update this policy if the position changes.

Supabase processes data on our instructions under a **Data Processing Addendum** and does not use member data for its own purposes.

---

## 11. Children's Data

**yi-connect does not process the personal data of children.**

Chapter membership is restricted to adults between the ages of 21 and 40, in line with Yi's national eligibility criteria. The Platform's intake forms reject entries with a date of birth indicating an age below 18.

The separate **Young Indians Parliament (YIP)** programme, which engages students in Classes 9 to 12, runs on a distinct intake system with its own verifiable parental consent flow as required by **Section 9 of the DPDP Act**. YIP data is not co-mingled with yi-connect chapter data, even where shared infrastructure is used at the database layer.

If a chapter administrator inadvertently uploads data of an individual under 18 to yi-connect (for example, a member's child at a family event), the chapter administrator must delete the entry immediately and notify the Grievance Officer.

---

## 12. Cookies and Analytics

yi-connect uses session cookies strictly necessary for authentication. We do not use third-party advertising cookies or fingerprinting trackers. Aggregate, non-identifying analytics may be collected to monitor application performance.

---

## 13. Changes to This Policy

We may update this policy from time to time. Material changes will be notified to members through an in-application banner and an email to the registered address at least **15 calendar days** before they take effect.

---

## 14. Contact

For any question about this policy or our data practices, write to:

**Omm Sharravana, Data Fiduciary**
yi-connect
[Address Line — TBD], Erode, Tamil Nadu, India
grievance@yi-connect.in [TBD]

---

*This policy is issued in English. A Tamil translation will be made available on request. In the event of any inconsistency, the English version prevails until a certified Tamil translation is published.*
