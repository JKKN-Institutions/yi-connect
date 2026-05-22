# Insurance Quote Brief — yi-connect

**Prepared for:** Director, yi-connect (Omm Sharravana, sole proprietorship)
**Purpose:** Request quotes from Indian insurers for cyber-liability and professional indemnity cover
**Last updated:** 22 May 2026

> [NOT LEGAL ADVICE — consult Indian DPDP-qualified counsel and a licensed insurance broker before binding any policy]

---

## 1. Why This Matters

yi-connect is presently operated as a **sole proprietorship**. This means:

- The Director's **personal assets** stand behind every claim arising from the business, with no corporate liability shield
- A single DPDP enforcement action (up to ₹250 crore under the DPDP Act, 2023) or class action by chapter members could exceed lifetime earnings
- The shared Supabase infrastructure with the YIP programme creates **cross-application exposure** — a breach of children's data in YIP is, in legal terms, a breach by the same Data Fiduciary who owns yi-connect
- Insurance is the only practical instrument to ring-fence personal liability until the business is incorporated as a private limited company

Three risks must be insured:

1. **Cyber-liability** — breach response, regulatory fines, third-party claims
2. **Professional indemnity (Errors and Omissions)** — claims that the software was negligently designed or maintained
3. **DPDP-specific regulatory cover** — fines and defence costs under the DPDP Act and forthcoming DPDP Rules

---

## 2. Insurers to Approach

| Insurer | Typical strength | Why relevant for yi-connect |
|---------|------------------|-----------------------------|
| **ICICI Lombard** | Largest private general insurer in India; well-developed SME cyber product | Strong claims infrastructure; broad distribution; DPDP-aware underwriting |
| **HDFC ERGO** | Established cyber and E&O lines; competitive on small-ticket policies | Good fit for sole-prop and micro-SME risk profile; flexible sub-limits |
| **Tata AIG** | Strong on technology-sector risks and breach-response panels | Often partners with reputable forensic and PR firms for incident response |

Approach all three. Do not rely on a single quote.

---

## 3. Coverage Parameters to Request

### Cyber-Liability

| Item | Parameter |
|------|-----------|
| First-party loss (forensic, restoration, BI) | ₹50 lakh to ₹1 crore |
| Third-party liability (claims from affected individuals) | ₹50 lakh to ₹1 crore |
| Regulatory cover (DPDP fines and defence) | Explicit sub-limit, minimum ₹25 lakh |
| Ransomware and extortion | Sub-limit ₹25 lakh |
| Business interruption | 90 days, sub-limit ₹15 lakh |
| Breach response (legal, forensic, notification, PR) | Within main limit; confirm panel access |

### Professional Indemnity (E&O)

| Item | Parameter |
|------|-----------|
| Aggregate limit | ₹50 lakh to ₹1 crore |
| Defence costs | Confirm whether **in addition to** the limit (preferred) or **within** |
| Retroactive date | As far back as the start of yi-connect development (request from 1 January 2025) |
| Run-off cover | Minimum 3 years available on cancellation |

### Common Across Both

| Item | Parameter |
|------|-----------|
| Deductible / excess | ₹50,000 to ₹2 lakh per claim, lower is better |
| Worldwide jurisdiction excluding USA / Canada | Acceptable for a domestic Indian product |
| Sub-limit for regulatory fines | Confirm; many policies cap this lower than the headline limit |

---

## 4. Estimated Annual Premium

| Coverage | Indicative range |
|----------|------------------|
| Cyber-liability, ₹50 lakh limit | ₹12,000 to ₹25,000 |
| Cyber-liability, ₹1 crore limit | ₹20,000 to ₹40,000 |
| Professional indemnity, ₹50 lakh | ₹8,000 to ₹15,000 |
| Combined package (cyber + E&O), ₹1 crore each | ₹25,000 to ₹45,000 |

These are indicative figures based on standard SME cyber-policy benchmarks in the Indian market. Actual premiums depend on disclosed risk factors and the insurer's appetite. Validate with quotes; do not budget on the indicative range alone.

---

## 5. Risk Factors to Disclose (Honest Disclosure List)

Non-disclosure or mis-disclosure voids the policy. Disclose all of the following in writing:

1. **Legal form:** Sole proprietorship; the Director carries unlimited personal liability
2. **Sibling product on shared infrastructure:** The Young Indians Parliament (YIP) programme runs on the same Supabase project and processes data of **minors (Classes 9 to 12)**. yi-connect does not directly process minor data, but the shared infrastructure and shared Data Fiduciary create joint exposure
3. **Scale:** Expecting 100 to 200 chapter customers within 12 to 18 months of launch; estimated 5,000 to 20,000 individual Data Principals in the database
4. **International data transfer:** Hosting on Supabase (United States). Disclosed in the privacy policy with member consent
5. **Conflicts of interest to disclose:**
   - Director is also the **Yi Erode chapter chair** (a customer / member-stakeholder of the Platform)
   - Director also operates **Jicate Solutions**, a software services firm that may build for related entities
6. **Regulatory regime:** DPDP Act, 2023, in force from 2026; final DPDP Rules pending; potential designation as a Significant Data Fiduciary if YIP minor-data processing crosses thresholds
7. **Security controls already in place:** Encryption at rest and in transit, RLS, role-based access, daily backups, audit logging, no plaintext credentials
8. **Known gaps:** No formal SOC 2 or ISO 27001 certification; no independent penetration test in the last 12 months; no formal DPIA conducted for YIP
9. **Prior claims and incidents:** None as of the date of this brief [confirm]

---

## 6. Questions to Ask Each Insurer

1. Does the policy explicitly cover claims arising from a sibling product (YIP) operated by the same Data Fiduciary on the same infrastructure? If not, can a specific extension be added?
2. What is the **sub-limit for DPDP regulatory fines** within the headline limit?
3. Is **retroactive cover** available, and from what date? (Important — most cyber claims surface months after the underlying incident.)
4. Are **defence costs separate from** the policy limit, or eroded by them?
5. Does the insurer maintain a **panel of breach-response vendors** (legal, forensic, PR) in India that can be engaged at policy rates? Names?
6. What is the policy's position on **ransomware payments** — is the insurer's prior approval required, and is the payment itself indemnified?
7. Is **business interruption** triggered only by an external attack, or also by a malicious insider or accidental data exposure?
8. What is the **claims process and average settlement time** for cyber claims in the last 24 months?
9. Are there **exclusions** for claims arising from open-source dependencies, third-party SaaS (Supabase, Vercel), or contractor-introduced vulnerabilities?
10. Does the insurer offer **risk-engineering services** — for example, a free or discounted external scan or DPIA — bundled with the policy?

---

## 7. Decision Matrix Template

Fill in after receiving the three quotes. Score each criterion 1 to 5; higher is better. Weight reflects relative importance.

| Criterion | Weight | ICICI Lombard | HDFC ERGO | Tata AIG |
|-----------|-------:|--------------:|----------:|---------:|
| Total annual premium (lower is better) | 15% |  |  |  |
| Headline limit offered | 15% |  |  |  |
| DPDP regulatory sub-limit | 15% |  |  |  |
| Defence costs treatment (separate preferred) | 10% |  |  |  |
| Retroactive cover available | 10% |  |  |  |
| Sibling-product (YIP) coverage explicitly confirmed | 10% |  |  |  |
| Breach-response panel quality | 10% |  |  |  |
| Claims reputation and settlement speed | 10% |  |  |  |
| Risk-engineering services included | 5% |  |  |  |
| **Weighted total** | **100%** |  |  |  |

Pick the highest weighted total **only if** the winner explicitly confirms YIP / sibling-product coverage in writing. If none confirm, escalate to a specialist broker before binding.

---

## 8. Recommended Next Steps

1. Engage a **licensed insurance broker** specialising in cyber and SME E&O — brokers do not charge the buyer and have access to wordings the public website does not show
2. Request quotes from all three insurers with the disclosure list in Section 5 attached
3. Compare wordings, not just premiums — a cheap policy with weak DPDP cover is a false economy
4. Bind cover **before** the first YIP intake cycle of the year and **before** crossing 50 paying chapter customers
5. Schedule annual policy review aligned with the financial year-end (31 March)
6. Reassess insurance posture when the business incorporates as a private limited company — premiums and structures change materially

---

*This brief is a planning document. Quotes received should be reviewed by the Director with a licensed broker and DPDP-qualified counsel before binding any policy.*
