# 🚀 DEVELOPER GUIDE for Yi Chapter Management - Part 3

## [cite_start]SECTION 5: BUSINESS RULES & PERMISSIONS [cite: 1547]

### [cite_start]Access Control by User Type [cite: 1548]

[cite_start]This section defines WHO can do WHAT in the yi-connect system[cite: 1549].

#### [cite_start]User Type 1: Yi Erode Members (80 members) [cite: 1550]

| Module                      | Permissions                                                                                                                                                                                                                                                                  | Restrictions (❌)                                                                                                                                                  |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Membership (M1)**         | [cite_start]✅ View own profile [cite: 1553][cite_start], ✅ Complete Skill-Will Assessment (mandatory for new members) [cite: 1554][cite_start], ✅ View assessment results [cite: 1555][cite_start], ✅ Accept/request vertical change (needs Chair approval)[cite: 1556]. | [cite_start]❌ Cannot view other members' assessment results (privacy) [cite: 1558][cite_start], ❌ Cannot change own vertical without Chair approval[cite: 1559]. |
| **Trainer (If applicable)** | [cite_start]✅ Mark availability calendar [cite: 1561][cite_start], ✅ Accept/Decline session requests (within 24 hrs) [cite: 1563][cite_start], ✅ Upload session materials (≥3 days before) [cite: 1564][cite_start], ✅ Submit post-session reports[cite: 1565].          | [cite_start]❌ Cannot see algorithm scoring [cite: 1566][cite_start], ❌ Cannot cancel session <48 hours before[cite: 1567].                                       |
| **Events (M3)**             | [cite_start]✅ View all Yi Internal/Service events [cite: 1569][cite_start], ✅ RSVP to events [cite: 1570][cite_start], ✅ Add carpool preferences[cite: 1571].                                                                                                             | [cite_start]❌ Cannot create Yi-level events [cite: 1573][cite_start], ❌ Cannot see chapter-specific events (unless Chapter Lead)[cite: 1574].                    |
| **Opportunities (M2 Ext)**  | [cite_start]✅ View/Apply to opportunities [cite: 1576, 1577][cite_start], ✅ Request custom industry visits [cite: 1579][cite_start], ✅ View application status [cite: 1580][cite_start], ✅ Withdraw application (before deadline)[cite: 1581].                           | [cite_start]❌ Cannot see other members' applications [cite: 1582][cite_start], ❌ Cannot post opportunities[cite: 1583].                                          |

[cite_start]**Priya's Dashboard Example:** Shows upcoming sessions/materials status, availability summary, new opportunities, and upcoming events[cite: 1587, 1588, 1591, 1594, 1599, 1601].

#### [cite_start]User Type 2: School/College Coordinators (External users) [cite: 1605]

| Module                           | Permissions                                                                                                                                                                                                                                                                                          | Restrictions (❌)                                                                                                                                                                                     |
| :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Access**                       | [cite_start]Get access via Chair adding them from stakeholder profile[cite: 1607]. [cite_start]Must change auto-generated password on first login[cite: 1609].                                                                                                                                       |                                                                                                                                                                                                       |
| **Booking Sessions**             | [cite_start]✅ Book Yi service events for **THEIR institution only** (Row-Level Security) [cite: 1612][cite_start], ✅ View trainer availability calendar (real-time) [cite: 1613][cite_start], ✅ View booking history [cite: 1615][cite_start], ✅ Cancel sessions (>48 hours before)[cite: 1616]. | [cite_start]❌ Cannot book for other schools/colleges [cite: 1617][cite_start], ❌ Cannot book <7 days in advance [cite: 1618][cite_start], ❌ Cannot see trainers' personal information[cite: 1619]. |
| **Session Materials**            | [cite_start]✅ Download approved materials [cite: 1621][cite_start], ✅ View materials version history[cite: 1622].                                                                                                                                                                                  | [cite_start]❌ Cannot upload materials [cite: 1623][cite_start], ❌ Cannot access unapproved materials[cite: 1624].                                                                                   |
| **Post-Session**                 | [cite_start]✅ Rate session (1-5 stars) [cite: 1626][cite_start], ✅ Submit written feedback[cite: 1627].                                                                                                                                                                                            | [cite_start]❌ Cannot see other schools' ratings[cite: 1629].                                                                                                                                         |
| **Chapter Mgmt (If applicable)** | [cite_start]✅ View chapter dashboard [cite: 1631][cite_start], ✅ Add/edit chapter member info[cite: 1632].                                                                                                                                                                                         | [cite_start]❌ Cannot create Yi-level events[cite: 1633].                                                                                                                                             |

[cite_start]**Security Rule (Critical):** Coordinator can only access data WHERE `stakeholder_id` = their `institution_id`[cite: 1655, 1656].

#### [cite_start]User Type 3: Yuva/Thalir Chapter Leads (Student members) [cite: 1660]

| Module                 | Permissions                                                                                                                                                                                | Restrictions (❌)                                                                                                                 |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| **Chapter Management** | [cite_start]✅ View their chapter dashboard [cite: 1669][cite_start], ✅ Add/edit chapter members [cite: 1670, 1671][cite_start], ✅ Mark members as inactive (graduate)[cite: 1672].      | [cite_start]❌ Cannot delete members (archive only) [cite: 1673][cite_start], ❌ Cannot create Yi Erode-level events[cite: 1679]. |
| **Chapter Events**     | [cite_start]✅ Create events for **THEIR chapter only** [cite: 1675][cite_start], ✅ Invite chapter members [cite: 1676][cite_start], ✅ Mark attendance/upload reports[cite: 1677, 1678]. | [cite_start]❌ Cannot invite members from other chapters (unless joint event approved)[cite: 1680].                               |
| **Reporting**          | [cite_start]✅ View chapter impact metrics/generate monthly reports[cite: 1682, 1683].                                                                                                     | [cite_start]❌ Cannot see other chapters' data[cite: 1684].                                                                       |

#### [cite_start]User Type 4: Industry Coordinators [cite: 1710]

| Module                    | Permissions                                                                                                                                                                                                                     | Restrictions (❌)                                                                                             |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------ |
| **Posting Opportunities** | [cite_start]✅ Post Industrial Visits, Internships, Mentorship [cite: 1716, 1717, 1718][cite_start], ✅ Edit active/Close early[cite: 1719, 1720].                                                                              | [cite_start]❌ Cannot post for other companies[cite: 1721].                                                   |
| **Managing Applications** | [cite_start]✅ View all applications [cite: 1724][cite_start], ✅ Accept/Waitlist/Decline [cite: 1725][cite_start], ✅ Download participant lists [cite: 1726][cite_start], ✅ View member profiles (limited info)[cite: 1728]. | [cite_start]❌ Cannot see members' personal contact info until they accept application (privacy)[cite: 1729]. |
| **Custom Visit Requests** | [cite_start]✅ View member-requested visits for **THEIR company** [cite: 1731][cite_start], ✅ Accept/Decline/Propose alternate dates[cite: 1732, 1733].                                                                        | [cite_start]❌ Cannot see requests sent to other companies[cite: 1734].                                       |
| **Partnership Mgmt**      | [cite_start]✅ View partnership lifecycle/impact metrics[cite: 1736, 1737].                                                                                                                                                     | [cite_start]❌ Cannot modify MoU dates[cite: 1739].                                                           |

#### [cite_start]User Type 5: Yi Vertical Chairs (Thalir, Yuva, Industry) [cite: 1763]

- [cite_start]**Thalir Chair:** ✅ Full access to Module 2 (School stakeholders) [cite: 1766][cite_start], ✅ Add/edit school coordinators [cite: 1767][cite_start], ✅ Assign trainers to school sessions (with algorithm) [cite: 1768][cite_start], ✅ Review and approve session materials [cite: 1769][cite_start], ✅ View all Thalir chapter dashboards[cite: 1771].
- [cite_start]**Yuva Chair:** ✅ Full access to Module 2 (College stakeholders) [cite: 1775][cite_start], ✅ Manage Yuva chapters [cite: 1777][cite_start], ✅ Assign trainers for career guidance sessions [cite: 1778][cite_start], ✅ View all Yuva chapter dashboards[cite: 1779].
- [cite_start]**Industry Chair:** ✅ Full access to Module 2 (Industry stakeholders) [cite: 1783][cite_start], ✅ Review member-requested custom visits (approve before forwarding) [cite: 1785][cite_start], ✅ Manage industry partnerships and MoUs[cite: 1786].

#### [cite_start]User Type 6: Yi Admin / Chair / Co-Chair [cite: 1826]

- [cite_start]**Full System Access:** Can do everything[cite: 1827].
  - [cite_start]**Membership:** View all profiles/assessments [cite: 1829, 1830][cite_start], Manually assign members/override recommendations[cite: 1831, 1832].
  - [cite_start]**Events:** Create/edit/cancel any event [cite: 1836, 1837][cite_start], View all events [cite: 1838][cite_start], Generate consolidated reports[cite: 1839].
  - [cite_start]**Stakeholders/Chapters:** Add/edit all stakeholders/coordinators [cite: 1841, 1842][cite_start], Manage MoUs [cite: 1843][cite_start], Create/edit/assign chapters/leads[cite: 1846, 1847].
  - [cite_start]**System Configuration:** Modify business rules (e.g., booking advance time) [cite: 1851][cite_start], Customize Skill-Will assessment [cite: 1852][cite_start], Configure algorithm weights[cite: 1853].

---

### [cite_start]Key Business Rules [cite: 1886]

#### [cite_start]Rule 1: Session Booking Restrictions [cite: 1887]

- [cite_start]**Minimum Advance Booking:** School/College sessions $\ge 7$ days in advance[cite: 1888, 1889].
- [cite_start]**Cancellation Policy:** Coordinator can cancel $>48$ hours before (no penalty)[cite: 1892]. [cite_start]Cancelling $24-48$ hours before $\rightarrow$ Warning[cite: 1893]. [cite_start]Trainer can decline $\rightarrow$ Within 24 hours of request (no penalty)[cite: 1895].

#### [cite_start]Rule 2: Trainer Assignment [cite: 1897]

- [cite_start]**Certification Requirement:** Masoom sessions $\rightarrow$ "Masoom TOT Level 1" or higher[cite: 1898]. [cite_start]Road Safety $\rightarrow$ "Road Safety Trainer Program"[cite: 1900].
- [cite_start]**Workload Limits:** No trainer assigned $>6$ sessions per month (prevents burnout)[cite: 1903, 1904].
- [cite_start]**Fair Distribution Enforcement:** Chair reviews "Trainer Workload Report" quarterly[cite: 1907]. [cite_start]If a trainer conducted $>30\%$ of sessions in their category, a flag is raised[cite: 1908].

#### [cite_start]Rule 3: Materials Approval [cite: 1909]

- [cite_start]**Upload Deadline:** Materials must be uploaded $\ge 3$ days before session[cite: 1911].
- [cite_start]**Approval Workflow:** Only Thalir/Yuva Chair (or Admin/Overall Chair) can approve materials[cite: 1914, 1915]. [cite_start]Coordinator **CANNOT** download if not approved[cite: 1916].

#### [cite_start]Rule 4: Chapter Hierarchy [cite: 1917]

- [cite_start]**Chapter Creation:** Only Yi Chair/Admin can create new chapters[cite: 1918]. [cite_start]Each chapter linked to a stakeholder (school/college)[cite: 1920].
- [cite_start]**Chapter Member Management:** Chapter Leads add members to **THEIR chapter only**[cite: 1922]. [cite_start]Chapter members are separate from Yi Erode members[cite: 1923].
- [cite_start]**Event Visibility:** Chapter events are visible only to chapter members[cite: 1926].

#### [cite_start]Rule 5: Industry Opportunities [cite: 1928]

- [cite_start]**Posting Eligibility:** Only industries with **ACTIVE MoU** can post opportunities[cite: 1930]. [cite_start]If MoU expires, all active opportunities are auto-closed[cite: 1931].
- [cite_start]**Application Limits:** Members can apply to unlimited opportunities, but can only withdraw **BEFORE** the deadline[cite: 1934, 1935].
- [cite_start]**Selection Transparency:** Industry must respond to all applications (Accept/Waitlist/Decline)[cite: 1937].

#### [cite_start]Rule 6: Data Privacy [cite: 1940]

- [cite_start]**Member Privacy:** Members CANNOT see other members' Skill-Will assessment results [cite: 1942] [cite_start]or applications[cite: 1943].
- [cite_start]**Coordinator Privacy:** Coordinators CANNOT see data from other institutions[cite: 1946].
- [cite_start]**Chapter Privacy:** Chapter Leads CANNOT see other chapters' data[cite: 1949].

---

## [cite_start]SECTION 6: REPORTS & DASHBOARDS [cite: 1952]

### [cite_start]Report 1: Monthly Impact Report (For Yi Chair) [cite: 1954]

[cite_start]Generated automatically on the 1st of each month[cite: 1955].

| Section                      | Key Metrics (Example: December 2025)                                                                                                                                                                                                                                                                                                             |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Membership**               | [cite_start]Total Members: 80 (+3 new)[cite: 1961]. [cite_start]Skill-Will completion rate (67%)[cite: 1963]. [cite_start]Vertical Distribution[cite: 1965].                                                                                                                                                                                     |
| **Thalir Vertical**          | [cite_start]School Sessions Conducted: 14[cite: 1972]. [cite_start]Students Benefited: **1,680 (actual count)**[cite: 1975]. [cite_start]Trainer Performance (Priya Navin $\rightarrow$ Top Performer)[cite: 1978, 1979]. [cite_start]Workload Distribution $\rightarrow$ **Top 3 trainers down to 50% of sessions (improvement!)**[cite: 1982]. |
| **Yuva Vertical**            | [cite_start]College Sessions Conducted: 8[cite: 1989]. [cite_start]**Chapter-led events: 15**[cite: 1995]. [cite_start]**Total Yuva impact: 2,100 students**[cite: 1996]. [cite_start]Top Performing Chapter (Sengunthar Yuva)[cite: 1997, 1998].                                                                                                |
| **Industry Engagement**      | [cite_start]Active Partnerships: 8 with MoU[cite: 2003]. [cite_start]Opportunities Provided: 3[cite: 2005]. [cite_start]Yi Members Benefited: 50[cite: 2011].                                                                                                                                                                                    |
| **Consolidated Impact**      | [cite_start]**Total Beneficiaries: 4,670 students** (Real numbers, not estimates)[cite: 2017, 2048]. [cite_start]**Chapter contributions visible**[cite: 2049].                                                                                                                                                                                  |
| **Alerts & Recommendations** | [cite_start]**🟢 POSITIVE TRENDS:** Trainer workload improved[cite: 2034]. [cite_start]**🟡 AREAS FOR ATTENTION:** 1 new member pending assessment [cite: 2038][cite_start], 2 industry MoUs expiring[cite: 2040]. [cite_start]**🔴 ACTION REQUIRED:** 5 trainers haven't marked availability for January[cite: 2042].                           |

### [cite_start]Report 2: Trainer Performance Dashboard (For Thalir/Yuva Chair) [cite: 2053]

- [cite_start]**Workload Distribution:** Table showing sessions/students/avg rating per trainer[cite: 2058, 2059]. [cite_start]Highlights **IMBALANCE DETECTED** (Top 3 trainers conducting 54% of sessions)[cite: 2072, 2073]. [cite_start]**Recommendation:** Pair high-performing with emerging trainers[cite: 2076].
- [cite_start]**Performance Breakdown:** Trainers categorized by rating ($\star\star\star\star\star$ Excellent, $\star\star\star\star$ Good, etc.)[cite: 2080, 2084, 2088].
- [cite_start]**Suggested Intervention:** Rahul Kumar's rating declined $\rightarrow$ ACTION: Recommend TOT refresher[cite: 2089, 2092].

### [cite_start]Report 3: School Engagement Report (For Thalir Chair) [cite: 2111]

- [cite_start]**Engagement Tiers:** Schools are categorized as **🟢 HIGHLY ENGAGED** ($\ge 10$ sessions/year) (e.g., Railway Colony) [cite: 2116, 2117, 2118][cite_start], **🟡 MODERATELY ENGAGED** [cite: 2126][cite_start], **🔴 LOW ENGAGEMENT** [cite: 2131][cite_start], or **⚫ INACTIVE**[cite: 2138]. [cite_start]Action items for low/inactive schools are listed[cite: 2135, 2142].
- [cite_start]**Service Type Preference:** Shows that schools prefer Masoom sessions (2:1 ratio vs Road Safety)[cite: 2145, 2149, 2153].
- [cite_start]**Geographic Distribution:** Highlights underserved areas (e.g., Gobichettipalayam) for expansion opportunities[cite: 2156, 2159, 2160, 2161].

### [cite_start]Report 4: Chapter Health Dashboard (For Yuva Chair) [cite: 2166]

- [cite_start]**Chapter Performance Scorecard:** Ranks chapters by Members, Events, Impact, and **Activity Score** (e.g., Sengunthar Yuva $\rightarrow$ 92/100 🟢)[cite: 2171, 2172, 2175, 2176].
- [cite_start]**Activity Score Calculation:** Based on Events/quarter (40 pts), Member participation (30 pts), Impact/student ratio (20 pts), and Leadership engagement (10 pts)[cite: 2189, 2190, 2191, 2192].
- [cite_start]**Intervention Needed:** For Struggling Chapters (e.g., Vellalar College Yuva $\rightarrow$ 42/100 🔴), lists specific issues (low event frequency, disengaged leadership) and actions (1-on-1 meeting, consider co-lead model)[cite: 2208, 2211, 2212, 2214, 2217, 2218].
- [cite_start]**Recommendations:** Feature successful chapters (Sengunthar Yuva) for recognition [cite: 2231, 2232][cite_start], and offer support (mentorship, event templates) to struggling ones[cite: 2234, 2235, 2237].

---

## [cite_start]SECTION 7: AI-ADAPTIVE FORM - TECHNICAL DETAILS [cite: 2245]

### [cite_start]How the Skill-Will Assessment Works [cite: 2246]

- [cite_start]**Form Structure:** A **5-Question Assessment**[cite: 2248]. [cite_start]Q1 is the base question, and Q2-Q5 are adaptive based on previous answers[cite: 2249, 2250].
- [cite_start]**Design Principle:** Questions probe for Energy source, Skill level, Will/motivation, Experience, and Learning preference[cite: 2253, 2254, 2255, 2256, 2257].

### [cite_start]Question Flow Example (Deepa Raj's Path) [cite: 2259]

- [cite_start]**Q1 (Base):** Deepa selects A) Working directly with children/students[cite: 2261, 2262, 2266].
- [cite_start]**Q2 (Adaptive):** Probes confidence in delivering a 2-hour session[cite: 2268, 2270]. [cite_start]AI Helper suggests B) Somewhat confident, based on her B.Tech background (analytical thinking) and newness to Yi[cite: 2285, 2287, 2289].
- [cite_start]**Q3 (Adaptive):** Probes time commitment[cite: 2298, 2300]. [cite_start]AI Helper suggests B) 2-3 sessions/month, as she runs a business (moderate commitment is realistic)[cite: 2310, 2312].
- [cite_start]**Q4 (Adaptive):** Probes past experience with children/training[cite: 2322, 2323]. [cite_start]Deepa selects D) Workshops, noting her client demo experience (speaking to groups)[cite: 2329, 2347, 2349].
- [cite_start]**Q5 (Adaptive/Final):** Probes preferred learning path[cite: 2351, 2352]. [cite_start]AI Helper suggests D) Mixed approach (TOT certification + mentored sessions) because she is "somewhat confident" and has no formal teaching experience[cite: 2363, 2366, 2368, 2369].

### [cite_start]Assessment Complete - Scoring Algorithm [cite: 2377]

- [cite_start]**SKILL SCORE:** Calculated from Q2 (Confidence), Q4 (Experience), and Profile bonus[cite: 2382, 2383, 2384, 2385]. [cite_start]**Result: MODERATE SKILL (5/10)**[cite: 2387].
- [cite_start]**WILL SCORE:** Calculated from Q1 (Energy), Q3 (Commitment), and Q5 (Learning)[cite: 2389, 2390, 2391, 2392, 2393]. [cite_start]**Result: HIGH WILL (8/10)**[cite: 2394].
- [cite_start]**SKILL-WILL CLASSIFICATION:** LOW SKILL + HIGH WILL = **ENTHUSIAST ⭐**[cite: 2397, 2398, 2399].
- [cite_start]**RECOMMENDED VERTICAL:** **THALIR**[cite: 2401].
- [cite_start]**Member Sees:** A summary of their profile (**⭐ ENTHUSIAST**), Recommended Vertical (THALIR), reasons, and a proposed **NEXT STEPS** roadmap (Training: Masoom TOT, Mentorship: Paired with Priya Navin, Solo Sessions: Month 4 onwards)[cite: 2424, 2426, 2428, 2433, 2437, 2438, 2442, 2443]. [cite_start]Member must **\[ACCEPT RECOMMENDATION]** or **\[REQUEST CHANGE]**[cite: 2448, 2455].

### [cite_start]AI Integration - Technical Implementation [cite: 2458]

- [cite_start]**GPT Integration:** Used for: [cite: 2459]
  1.  [cite_start]**Question Generation:** Dynamically generates adaptive questions (Q2-Q5) based on prior answers[cite: 2461, 2462].
  2.  [cite_start]**AI Helper Functionality:** Suggests the best answer option for the user's profile and provides reasoning/confidence score[cite: 2471, 2472, 2480, 2481].
  3.  [cite_start]**Scoring Algorithm:** Sends all 5 answers + profile data to GPT to classify the user (Stars, Enthusiasts, Cynics, Dead Wood) and recommend a vertical[cite: 2483, 2484, 2485, 2486, 2487, 2488, 2489].
- [cite_start]**Privacy & Data:** User answers and GPT responses are stored/logged (for review and algorithm improvement)[cite: 2492, 2493].
