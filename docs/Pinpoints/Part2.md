# 🚀 DEVELOPER GUIDE for Yi Chapter Management - Part 2

## [cite_start]SECTION 3: EVENTS MANAGEMENT - IMPROVEMENTS & NEW FEATURES [cite: 501]

### [cite_start]Current State: What Exists in Module 3 [cite: 502]

[cite_start]Module 3 (Events Management) currently allows Yi Erode members to: [cite: 503]

- [cite_start]Create events with basic details [cite: 504]
- [cite_start]Send RSVP invitations [cite: 505]
- [cite_start]Track attendance with simple present/absent marking [cite: 506]
- [cite_start]View upcoming events in a list format [cite: 507]

### [cite_start]Problems We're Solving [cite: 512]

[cite_start]**Pain Point 1: Manual Trainer Matching (600+ Touchpoints/Year)** [cite: 513]

- [cite_start]**Current Process:** Thalir Chair manually checks an Excel file, remembers who recently conducted sessions, checks WhatsApp for availability, sends broadcast messages, waits for responses (5-7 days)[cite: 516, 517, 519, 520, 521, 524].
- [cite_start]**Problems:** Inequitable distribution (Top 3 trainers do 60% of sessions) [cite: 526][cite_start], Location ignored [cite: 527][cite_start], Performance not considered [cite: 528][cite_start], Time-consuming (12,000 manual touchpoints/year) [cite: 529][cite_start], No data on individual trainer sessions[cite: 530].

[cite_start]**Pain Point 2: Materials Approval via WhatsApp** [cite: 535]

- [cite_start]**Current Process:** Trainer uploads a large PPT file to WhatsApp $\rightarrow$ WhatsApp compresses it (fonts break, animations lost)[cite: 539]. [cite_start]Chair reviews on a small phone screen, replies with feedback[cite: 540, 541]. [cite_start]Trainer re-edits/re-uploads (version confusion: `v2? v3_FINAL?`)[cite: 542]. [cite_start]School downloads the compressed version[cite: 544].
- [cite_start]**Problems:** File compression ruins quality [cite: 546][cite_start], Version confusion [cite: 547][cite_start], No audit trail [cite: 548][cite_start], Lost files [cite: 549][cite_start], School gets compressed version[cite: 550].

[cite_start]**Pain Point 3: No Real-Time Visibility into Trainer Availability** [cite: 551]

- [cite_start]**Current Process:** Chair maintains a mental map of who is available (Priya can't do Fridays, Deepa is blocked all December)[cite: 553, 554, 555]. [cite_start]Information is scattered[cite: 557].
- [cite_start]**Problem:** Chair has to broadcast to all 18 trainers even if 12 are known to be unavailable[cite: 559].

### [cite_start]How the Solution Works [cite: 560]

#### [cite_start]Solution 1: Smart Event Creation Form with Conditional Fields [cite: 561]

- [cite_start]**What changes:** The event creation form adapts based on the **Event Category** selected (e.g., Yi Internal Event, **Yi Service Event** $\leftarrow$ Selected)[cite: 563, 568, 570].
- [cite_start]**If "Yi Service Event" selected, show conditional fields:** Service Type (Masoom) $\rightarrow$ Institution (Railway Colony) $\rightarrow$ Contact Person (auto-filled) $\rightarrow$ Date/Time $\rightarrow$ Expected Students (120)[cite: 574, 575, 579, 581, 583, 587].
- [cite_start]**Smart Features:** Auto-calculates **Trainers Needed** (1 trainer per 60 students $\rightarrow$ 2 trainers)[cite: 589, 591]. [cite_start]**Validation:** Cannot book $<7$ days in advance[cite: 605]. [cite_start]Redirects to "Assign Trainers" page upon saving[cite: 599, 606].

#### [cite_start]Solution 2: Trainer Auto-Assignment Algorithm [cite: 606]

[cite_start]When the Chair clicks "Save & Assign Trainers", the system runs an algorithm[cite: 608].

| Rank | Trainer Name        | Score  | [cite_start]Breakdown (Dec 5, 2:00 PM - 4:00 PM) [cite: 616, 617]                                                                                                                                                                                                                                                                                                |
| :--- | :------------------ | :----- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🥇 1 | **Deepa Raj**       | 92/100 | [cite_start]**Location:** 30/30 (Erode) $\checkmark$[cite: 618]. [cite_start]**Fairness:** 30/30 (Last session: 45 days ago) $\checkmark$[cite: 619]. [cite_start]**Performance:** 23/25 (4.6 $\star$ avg)[cite: 620]. [cite_start]**Status:** ✅ AVAILABLE [cite: 622]                                                                                          |
| 🥈 2 | **Kavitha Senthil** | 88/100 | [cite_start]**Location:** 30/30 (Erode) $\checkmark$[cite: 625]. [cite_start]**Fairness:** 27/30 (Last session: 32 days ago)[cite: 626]. [cite_start]**Performance:** 20/25 (4.0 $\star$ avg)[cite: 627]. [cite_start]**Status:** ✅ AVAILABLE [cite: 629]                                                                                                       |
| 🥉 3 | Priya Navin         | 71/100 | [cite_start]**Location:** 30/30 (Erode) $\checkmark$[cite: 632]. [cite_start]**Fairness:** 12/30 ⚠️ (Last session: 7 days ago)[cite: 633]. [cite_start]**Performance:** 25/25 (5.0 $\star$ avg)[cite: 634]. **Note:** Priya has conducted 42 sessions this year (26% of all sessions). [cite_start]**Consider giving others opportunity.** [cite: 637, 638, 639] |

[cite_start]**Scoring Algorithm Breakdown (Max 100 points):** [cite: 662]

1.  [cite_start]**Location Proximity (30 points max):** Same city (30 points), Adjacent (<20km) (20 points)[cite: 663, 664, 665].
2.  [cite_start]**Fair Distribution (30 points max):** Based on days since last session (60+ days ago = 30 points, $<7$ days = 0 points)[cite: 668, 669, 670, 674].
3.  [cite_start]**Performance Rating (25 points max):** Based on school ratings (4.5-5.0 $\star$ = 25 points, $<3.0$ $\star$ = 5 points)[cite: 675, 677, 681].
4.  [cite_start]**Engagement Score (15 points max):** Based on overall Yi activity (80%+ attendance = 15 points, $<40\%$ = 5 points)[cite: 682, 684, 687].

[cite_start]**Trainer Notification:** Trainer receives a "NEW SESSION REQUEST" with event details, co-trainer name, special notes, and Materials Upload Deadline[cite: 697, 703, 705, 707]. [cite_start]Must **\[ACCEPT]** or **\[DECLINE - provide reason]** within 24 hours[cite: 708, 709].

#### [cite_start]Solution 3: Materials Approval Workflow [cite: 712]

- [cite_start]**Trainer Upload:** Trainers upload materials (PPT, PDF, DOCX, max 50 MB) directly to the upcoming session's page, including Trainer Notes on key changes[cite: 714, 729, 735, 736, 737].
- [cite_start]**Chair Review:** Chair receives **📬 NEW MATERIAL UPLOADED - REVIEW NEEDED** notification[cite: 753]. [cite_start]Review interface shows **Trainer Notes**[cite: 772, 775]. [cite_start]Chair can **\[DOWNLOAD & REVIEW OFFLINE]** [cite: 776] [cite_start]and make a decision: **● APPROVE** or **○ REQUEST REVISIONS** (with Revision Notes required)[cite: 781, 782, 784].
- [cite_start]**School Download:** After Chair approves (e.g., Nov 27, 9:15 AM) [cite: 800, 801][cite_start], the School Coordinator automatically sees a green badge **✅ APPROVED** and can **\[📥 DOWNLOAD MATERIALS]** (the original, uncompressed file)[cite: 816, 817, 824].

#### [cite_start]Solution 4: Real-Time Availability Calendar Integration [cite: 829]

- [cite_start]**Trainer Action:** Trainers mark their availability (✅ AVAILABLE / 🔴 BLOCKED / ⚪ NOT MARKED) monthly on their calendar[cite: 831, 849, 850, 851].
- [cite_start]**System Action:** During auto-assignment, the algorithm **filters to only show trainers marked "Available"** on that date[cite: 865, 866, 867].
- [cite_start]**Benefit:** Reduces assignment time from 24-48 hours (manual broadcasts) to **2 minutes** (automated filtering)[cite: 875, 879].

### [cite_start]Changes Needed to Module 3 [cite: 881]

| Change        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | New Page/Location                                                                         |
| :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **Change 1:** | [cite_start]**Conditional/Smart Event Creation Form:** Event Category selection at top[cite: 885, 886]. [cite_start]Conditional fields render based on category (e.g., if 'Yi Service Event' is selected, show Service Type, Institution, auto-calculated Trainers Needed)[cite: 891, 892, 893, 896]. [cite_start]Includes validation rules (e.g., cannot book <7 days in advance)[cite: 908, 909].                                                                                                                                     | [cite_start]`/app/(dashboard)/events/create/page.tsx` [cite: 883]                         |
| **Change 2:** | [cite_start]**"Assign Trainers" Flow with Algorithm:** New page shows event summary, algorithm recommendations table (Rank, Score, Location/Fairness/Performance/Engagement Points)[cite: 915, 917, 922]. [cite_start]Filters only certified trainers[cite: 927]. [cite_start]Allows Chair to auto-select top N or manually select[cite: 931, 932]. [cite_start]Sends notifications upon confirmation[cite: 939].                                                                                                                       | [cite_start]New Page: `/app/(dashboard)/events/[id]/assign-trainers/page.tsx` [cite: 915] |
| **Change 3:** | [cite_start]**Category Filter Tabs on Events Dashboard:** Add tabs for filtering events (e.g., \[All (98)], \[School Services (35)])[cite: 943, 946]. [cite_start]Implement color-coding for event cards based on category[cite: 947, 948, 949, 950, 951, 952].                                                                                                                                                                                                                                                                         | [cite_start]`/app/(dashboard)/events/page.tsx` [cite: 943]                                |
| **Change 4:** | [cite_start]**Materials Approval Workflow Section:** New "Materials" tab in event details[cite: 967]. [cite_start]Shows upload interface for assigned trainers[cite: 968, 970]. [cite_start]Shows review interface for Chair/Admin (with Download, Approve/Request Revisions options)[cite: 981, 982]. [cite_start]Shows download interface for School/College Coordinator (only after approval)[cite: 998, 1001]. [cite_start]Includes Version history tracking[cite: 1007, 1009].                                                     | [cite_start]`/app/(dashboard)/events/[id]/page.tsx` [cite: 965]                           |
| **Change 5:** | [cite_start]**Update Attendance Marking with Actual Student Counts:** Replaces simple attendance with a **POST-SESSION REPORT** form (visible after event date)[cite: 1017, 1019]. [cite_start]Collects Trainer Attendance [cite: 1023][cite_start], **Actual Students Attended** (not estimates) [cite: 1028][cite_start], Breakdown by Class/Gender [cite: 1030, 1033][cite_start], School Rating (1-5 stars) [cite: 1036, 1037][cite_start], and Trainer Notes[cite: 1049, 1050].                                                    | [cite_start]`/app/(dashboard)/events/[id]/page.tsx` (Attendance tab) [cite: 1011]         |
| **Change 6:** | [cite_start]**RSVP Conditional Fields for Carpool Coordination:** When RSVP'ing to events requiring travel (e.g., Industrial Visit) [cite: 1069, 1071][cite_start], members select **TRAVEL PREFERENCE** (Own vehicle/Need a ride/Arrange own)[cite: 1079, 1081, 1082]. [cite_start]Drivers specify **Available Seats**[cite: 1084]. [cite_start]Members needing rides specify **Preferred Pickup Location**[cite: 1089, 1092]. [cite_start]Event Organizer sees **SUGGESTED CARPOOL GROUPS** and can confirm/modify[cite: 1116, 1121]. | [cite_start]`/app/(dashboard)/events/[id]/page.tsx` (RSVP section) [cite: 1065]           |

---

## [cite_start]SECTION 4: INDUSTRY OPPORTUNITIES - BIDIRECTIONAL SYSTEM [cite: 1134]

### [cite_start]Current State: What Exists in Module 2 [cite: 1135]

[cite_start]Module 2 tracks industries with basic info (name, contact, MoU status)[cite: 1136, 1137, 1139].

- [cite_start]**Missing:** No structured way for industries to **POST opportunities** [cite: 1142][cite_start], no application system for members [cite: 1143][cite_start], and no tracking of partnership lifecycle[cite: 1144].

### [cite_start]Problems We're Solving [cite: 1145]

[cite_start]**Pain Point 1: Lost Industrial Visit Opportunities** [cite: 1146]

- [cite_start]**Current Process:** Industry calls Chair $\rightarrow$ Chair manually takes notes $\rightarrow$ Chair posts to WhatsApp group $\rightarrow$ Members DM Chair (20 individual messages) $\rightarrow$ Chair manually creates list $\rightarrow$ No record of applications[cite: 1149, 1150, 1151, 1152, 1153, 1154].
- [cite_start]**Problems:** Informal tracking [cite: 1156][cite_start], No visibility outside WhatsApp [cite: 1157][cite_start], Chair is a bottleneck [cite: 1158][cite_start], No history[cite: 1159].

[cite_start]**Pain Point 2: Members Can't Request Visits** [cite: 1160]

- [cite_start]**Current Process:** Member asks Chair about a specific industry (e.g., CNC machine shop) $\rightarrow$ Chair checks manual list $\rightarrow$ Chair calls industry[cite: 1162, 1164, 1165].
- [cite_start]**Problems:** Member-driven learning blocked [cite: 1168][cite_start], Underutilized relationships [cite: 1169][cite_start], No structured requests[cite: 1170].

### [cite_start]How the Solution Works [cite: 1171]

#### [cite_start]Solution 1: Industry-Posted Opportunities [cite: 1172]

- [cite_start]Industry Coordinator logs in and uses the **POST OPPORTUNITY FOR YI MEMBERS** form[cite: 1175].
- [cite_start]They select **OPPORTUNITY TYPE** (Industrial Visit $\leftarrow$ Selected, Internship, Mentorship, etc.)[cite: 1179, 1180].
- [cite_start]Fill in Title, Description, Date/Time, **Maximum Participants** (20)[cite: 1186, 1189, 1201, 1205].
- [cite_start]Set **ELIGIBILITY CRITERIA** (Relevant Industries/Domains: Manufacturing, Experience Level: Early/Established Entrepreneurs)[cite: 1207, 1208, 1214].
- [cite_start]Set **APPLICATION DEADLINE**[cite: 1232].
- [cite_start]**After Publishing:** Industry coordinator can **\[REVIEW APPLICATIONS]**[cite: 1241].

#### [cite_start]Solution 2: Member Application System [cite: 1242]

- [cite_start]**Member Dashboard:** Priya sees **OPPORTUNITIES FOR YOU (3 NEW)**[cite: 1246]. [cite_start]Opportunities are listed with Company, Date, Slots, Deadline, and a **Match Score** (e.g., HIGH match for Manufacturing Excellence Tour)[cite: 1248, 1253].
- [cite_start]**Application Form:** Priya clicks **\[APPLY NOW]**[cite: 1254]. [cite_start]The form auto-fills her profile (Name, Business, Industry)[cite: 1276]. [cite_start]She must answer **WHY DO YOU WANT TO ATTEND?** (Required)[cite: 1281]. [cite_start]She specifies **TRANSPORTATION** (Own transport/Need carpool) and **DIETARY PREFERENCE**[cite: 1296, 1297, 1299, 1300].
- [cite_start]**After Submitting:** Status: **PENDING REVIEW**[cite: 1312]. [cite_start]She will be notified when the company reviews it[cite: 1314].

#### [cite_start]Solution 3: Member-Requested Visits [cite: 1317]

- [cite_start]**Deepa's Dashboard:** She clicks **\[REQUEST VISIT]**[cite: 1324, 1325].
- [cite_start]**Request Form:** She must **SELECT INDUSTRY** (only active MoU partners like CRI Pumps listed)[cite: 1331, 1339]. [cite_start]She details the **VISIT PURPOSE** (e.g., to learn about hydraulic pump systems)[cite: 1341, 1342]. [cite_start]She selects **VISIT TYPE** (Solo Visit $\leftarrow$ Selected / Group Visit)[cite: 1357].
- [cite_start]**Submission $\rightarrow$ Yi Industry Chair reviews** (1-2 days), and if approved, forwards to the industry coordinator[cite: 1379, 1380, 1381].

#### [cite_start]Solution 4: Industry Dashboard for Managing Applications [cite: 1386]

- [cite_start]**Industry Coordinator Dashboard:** Shows **ACTIVE OPPORTUNITIES** with **Applications Received** (e.g., 28 applications for 20 slots)[cite: 1391, 1396].
- [cite_start]**Review Applications:** Coordinator can **Sort by: Relevance Score** [cite: 1405] [cite_start]and filter[cite: 1408].
- [cite_start]**Review Interface:** Each application shows Relevance score (e.g., ⭐⭐⭐ HIGH MATCH for Priya Navin) [cite: 1412][cite_start], Profile details, Why Attending, Learning Goals, and Yi Activity Score[cite: 1414, 1418, 1422, 1426].
- [cite_start]**Decision:** Coordinator can select **☑ ACCEPT / ☐ WAITLIST / ☐ DECLINE** for each applicant[cite: 1428]. [cite_start]They can also **\[BULK ACCEPT TOP 20]**[cite: 1447].
- [cite_start]**After Selection:** Accepted, Waitlisted, and Declined members are **all notified via email**[cite: 1450, 1454].

---

### [cite_start]Changes Needed to Module 2 [cite: 1462]

| Change        | Description                                                                                                                                                                                                                                                                                                                                                                     | New Page/Location                                                                                  |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| **Change 1:** | [cite_start]**Create Industry Opportunities Section:** New **"Opportunities" tab** in industry stakeholder profile (for Yi Chair/Admin to view, and Industry Coordinator to post/manage)[cite: 1464, 1466, 1469].                                                                                                                                                               | [cite_start]`/app/(dashboard)/stakeholders/[id]/page.tsx` (for Industry stakeholders) [cite: 1464] |
| **Change 2:** | [cite_start]**Create Member Opportunities Dashboard:** New page with filter tabs: **\[For You (3)]** (matches member profile) $\rightarrow$ **\[All Opportunities (12)]** $\rightarrow$ **\[My Applications (5)]** $\rightarrow$ **\[Request Visit]** (custom visit form)[cite: 1480, 1483, 1484, 1485, 1488, 1491, 1495].                                                      | [cite_start]New Page: `/app/(dashboard)/opportunities/page.tsx` [cite: 1480]                       |
| **Change 3:** | [cite_start]**Add Partnership Lifecycle Tracking:** New section at the top of the industry profile showing **Current Stage** (e.g., 🟢 ACTIVE COLLABORATION) and **Timeline** (MoU Signed, First Opportunity Posted, MoU Renewal Due)[cite: 1501, 1502, 1504, 1507, 1509, 1510]. [cite_start]Automatic reminders are sent 90/30 days before MoU expiry[cite: 1519, 1520, 1521]. | [cite_start]`/app/(dashboard)/stakeholders/[id]/page.tsx` (industry profile) [cite: 1499]          |
| **Change 4:** | [cite_start]**Add Industry Impact Metrics:** New **"Impact Dashboard"** section showing **Opportunities Provided** (8) [cite: 1528][cite_start], **Yi Members Benefited** (95) [cite: 1532][cite_start], Average Rating (4.7 $\star$), and **Top Learning Outcomes** (from member feedback)[cite: 1536, 1538].                                                                  | [cite_start]`/app/(dashboard)/stakeholders/[id]/page.tsx` (industry profile) [cite: 1524]          |
