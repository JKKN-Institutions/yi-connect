# Module 1: Member Intelligence Hub 🧠

## Overview
**Purpose:** Transform invisible member skills into visible, searchable, matchable intelligence that enables smart volunteer coordination and reduces leadership bottleneck.

**Priority:** The most critical module — build this first.

---

## User Roles & Permissions
- **Member:** Edit own profile only  
- **EC Member:** View all profiles, search/filter  
- **Chair/Co-Chair/EM:** Full access + engagement scoring + gap analysis

---

## 1.1 Member Profile (CRUD)

### Create - New Member Onboarding
**Trigger:** EM adds new member after payment confirmation

#### Data to Capture
##### Basic Information
- Full name *(required)*  
- Email *(required, unique; used for login)*  
- Phone *(required; for WhatsApp integration)*  
- Photo *(optional; drag-drop upload)*  
- Date of Birth *(for age eligibility)*  
- Gender *(for diversity analytics)*  
- Join Date *(auto-set to today)*  
- Renewal Date *(auto-calculated: join date + 1 year)*  
- Membership Type *(Individual / Couple)*  
- Family Count *(default 0)*

##### Professional Information
- Company Name  
- Industry *(dropdown: Technology, Manufacturing, etc.)*  
- Job Role  
- Years of Experience  
- LinkedIn Profile *(optional)*

##### Skills Inventory (Multi-Select)
**Professional Skills:** Finance, Legal, HR, Marketing, Sales, Technology, Design, Operations, Healthcare, Education.  
**Yi-Specific Skills:** Public Speaking, Training Delivery, Writing, Facilitation, Project Management, Fundraising, Government Relations, NGO Collaboration, Sports Coordination, Event Documentation.

**Skill Level:** Beginner / Intermediate / Advanced / Expert

##### Languages
Check boxes for Tamil, English, Hindi + text field for others.

##### Certifications (Repeating Section)
| Field | Example |
|--------|----------|
| Certification Name | Masoom ToT |
| Issued By | Yi National |
| Issue Date | 2024-01-10 |
| Expiry Date | Optional |
| Certificate File | Optional |

##### Willingness Assessment
Overall Willingness (1–5 scale):  
🔥 Activist (5/5) → ⭐ Regular (4/5) → ✅ Selective (3/5) → 🕐 Occasional (2/5) → 👀 Passive (1/5)

##### Vertical Interests
Masoom, Road Safety, Yuva, Thalir, Climate, Rural Dev, Health, Sports, Innovation, Arts.

##### Availability Profile
- Time Commitment (2 / 5 / 10 / 15+ hrs per week)  
- Preferred Days (Weekdays / Weekends / Flexible)  
- Notice Period (2 hrs → 1 month)  
- Geographic Flexibility (Erode → Pan‑India)  
- Preferred Contact (WhatsApp / Email / Phone / Notification)

##### Network & Connections
Add access to **Schools, Colleges, Industries, Government, NGOs, Venues, Speakers, Corporate Partners.**

##### System‑Calculated Fields
Member Status / Engagement Score / Last Active / Events Attended / Volunteer Hours / Leadership Readiness / Skill‑Will Quadrant.

#### Workflow After Creation
- Send welcome email with login  
- Add birthday to calendar  
- Assign to *New Members Cohort*  
- Reminder: Schedule induction  
- Notifications to Member, Chair, Membership Vertical

#### Reusable Components
`<MemberProfileForm/>`, `<SkillSelector/>`, `<WillingnessScale/>`, `<AvailabilityCalendar/>`, `<NetworkConnectionInput/>`, `<FileUploader/>`

---

### Read - Member Directory
**List View:**
- Filters (role, vertical, willingness, availability, status, skills, industry, experience)
- Sort (Name A–Z, Join Date, Engagement, Last Active, Renewal)
- Card view with photo, role, top skills, willingness rating, engagement bar
- Bulk Actions: Message / Assign Project / Export CSV / Group Add
- Search Bar: Name, Company, Skills (fuzzy, instant)

**Grid View:** photos + names  
**Map View:** show members by location (for carpooling)

Reusable: `<MemberCard/>`, `<MemberGrid/>`, `<FilterSidebar/>`, `<SearchBar/>`, `<BulkActionToolbar/>`

---

### Read - Individual Member Profile
**Tabs:**
1. **Overview** – Professional info, Contact details, Membership info  
2. **Skills & Availability** – Skills matrix, languages, certifications, willingness, schedule  
3. **Network & Connections** – Stakeholder access, CSR potential  
4. **Activity & Engagement** – Score breakdown, attendance heatmap, activity timeline, stats  
5. **History** – Roles, certifications expired, vertical history, renewals, feedback

Reusable: `<ProfileHeader/>`, `<SkillsMatrix/>`, `<CertificationBadge/>`, `<EngagementScore/>`, `<AttendanceHeatmap/>`, `<ActivityTimeline/>`, `<StatCard/>`

---

### Update - Edit Profile
- **Who:** Member (own), EM (all), Chair/Co‑Chair (all + roles)  
- **Validation:** unique email, valid phone, ≥1 skill, willingness + availability set
- **After Update:** show toast → notify vertical chairs if skills or availability changed → log change
- **Annual Refresh:** every Dec 31 → "Update your profile for next year"

---

### Delete - Deactivate Member
- No hard delete; mark Inactive  
- Keeps history; hides from active lists  
- Stop renewal reminders

**Workflow:** EM initiates → ask reason + exit notes → confirm → send farewell email → remove WhatsApp groups → allow future reactivation.

---

## 1.2 Skill / Will Matrix Visualization
**Purpose:** Visual 4‑quadrant showing member distribution.

```
      HIGH WILL
 STAR | RISING
 PERF.| STARS
------|------
UNTAPP|PASSENGERS
```

- **Skill Score:** avg levels (1–4)  
- **Will Score:** 1–5 scale  
- Threshold ≥3 each = Star Performer

Interactive: click to filter members; hover shows scores; export CSV.  
Reusable: `<ScatterPlot/>`, `<QuadrantFilter/>`

---

## 1.3 Smart Volunteer Matching
**Use Case:** Find right volunteers for specific tasks.

**Input:** Task, Required Skill (+ level), Date/Time, Location, Notice Period.

**Logic:** Filter Active members by skill, willingness ≥3, availability, notice ≤ days, geography.

**Rank by:** Engagement, past domain participation, last volunteered.

Output → recommendations with [Assign] / [Message] buttons.  
Reusable: `<VolunteerMatchingForm/>`, `<MatchRecommendationCard/>`, `<BulkAssignDialog/>`

---

## 1.4 Engagement Scoring Engine
Automatically calculates 0‑100 score from:
- Event Attendance (40%)  
- Volunteer Hours (30%)  
- Leadership (20%)  
- Communication (10%)

Tier Levels:  
🌟 90–100 Star  | ⭐ 75–89 Active  | ✅ 60–74 Regular  | 🕐 40–59 Occasional  | 👀 0–39 Passive

Auto‑recalculate after each event/volunteer update + monthly.  
Reusable: `<EngagementScoreCard/>`, `<EngagementTrendChart/>`, `<TierBadge/>`

---

## 1.5 Gap Analysis Dashboard
Shows what skills / capacity chapter is missing.

Sections: Skill Gaps, Vertical Capacity, Leadership Pipeline, Network Gaps.  
Reusable: `<GapAnalysisCard/>`, `<CapacityMeter/>`, `<ActionRecommendation/>`

---

## 1.6 Leadership Pipeline Tracker
Tracks progress to leadership roles (Year 0→7 path).  
Calculates Readiness Score from criteria (EC experience, projects, RCMs, academy, engagement, skills, will).  
Reusable: `<ReadinessScoreCard/>`, `<ProgressionTimeline/>`, `<MentorshipMatcher/>`

---

## Data Relationships
```
Members → Certifications, Skills, ActivityLogs, RSVPs, Tasks, Hours, Fees, EngagementScores
Skills → MemberSkills (many‑to‑many)
Certifications → belongs to Member
EngagementScores → derived from attendance + hours + leadership + communication
```

---

## Automation Triggers
- **Profile Incomplete Reminder:** <50% after 7 days → email
- **Annual Profile Refresh:** Jan 1 → email all
- **Certification Expiry:** 30 days → notify member + EM
- **Low Engagement:** <40 → alert Chair
- **Leadership Readiness:** ≥70% → notify Chair
- **Skill Gap Alert:** critical shortage → notify Chair + Membership team

---

## Reusable Components Summary
**Forms:** `<MemberProfileForm/>`, `<SkillSelector/>`, `<WillingnessScale/>`, `<AvailabilityPicker/>`, `<NetworkConnectionInput/>`, `<CertificationInput/>`  
**Displays:** `<MemberCard/>`, `<MemberGrid/>`, `<ProfileHeader/>`, `<SkillsMatrix/>`, `<CertificationBadge/>`, `<EngagementScoreCard/>`, `<AttendanceHeatmap/>`, `<ActivityTimeline/>`, `<StatCard/>`  
**Visualizations:** `<SkillWillMatrix/>`, `<EngagementTrendChart/>`, `<CapacityMeter/>`, `<ReadinessScoreCard/>`, `<ProgressionTimeline/>`  
**Workflows:** `<VolunteerMatchingForm/>`, `<MatchRecommendationCard/>`, `<BulkAssignDialog/>`, `<MentorshipMatcher/>`, `<GapAnalysisCard/>`  
**Utilities:** `<FilterSidebar/>`, `<SearchBar/>`, `<BulkActionToolbar/>`, `<FileUploader/>`, `<QuadrantFilter/>`

---

_End of Module 1 – Member Intelligence Hub_

