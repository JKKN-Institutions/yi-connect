# Module 5: Succession & Leadership Pipeline 👥

## Purpose
Automate the 7-step Yi leadership succession process, reducing 50+ hours of coordination effort. Ensure confidentiality, timely reviews, and structured leadership transitions.

---

## 5.1 Automated Timeline Manager

### Features
- Auto-creates the annual succession workflow on **September 1**.
- Step-by-step checklist visible to Chair, Co-Chair, Mentor, EM.
- Each step includes: deadline, owner, and status (Not Started / In Progress / Complete).
- Red alerts for overdue items.

Reusable Component: `<SuccessionTimeline/>`

---

## 5.2 Candidate Nomination Hub

### Process
- **Week 1 (Sept):** Prompts Chair/Co-Chair/Mentor: *“Identify 3–5 Co-Chair candidates by Sept 15.”*
- Private submissions compiled automatically; duplicates removed.
- Consolidated matrix showing who nominated whom.

Example Output:
| Candidate | Chair | Co-Chair | Mentor | RC |
|------------|--------|----------|--------|----|
| Yadhavi | ✅ | ✅ | ✅ | ✗ |
| Sakthi | ✅ | ✗ | ✅ | ✗ |

Reusable Component: `<CandidateNomination/>`

---

## 5.3 Criteria Evaluation Wizard

### Purpose
Automate the evaluation criteria for each candidate:
- EC Experience ≥2 years
- Led ≥1 project
- Attended ≥2 RCMs
- Completed Leadership Academy
- Engagement ≥75
- Skills ≥3
- Willingness ≥4

Auto-calculates readiness score (e.g., 6/7 = 86%).

Reusable Component: `<EligibilityCheck/>`

---

## 5.4 Core Group Scoring System

### Process
- Weeks 2–3 (Oct): Personalized links sent to Past Chairs.
- They rate each candidate (1–10 scale) across attributes:
  - Leadership
  - Teamwork
  - Adaptability
  - Time Discipline
  - Purpose Clarity
- Scores compiled automatically and anonymized.

Reusable Component: `<ScoringForm/>`

---

## 5.5 Regional Chair Review Portal

### Features
- RC dashboard showing candidate profiles, EC experience, past leadership roles.
- Displays Core Group scores.
- Option to add or recommend candidates.
- Built-in video call scheduler for review meeting.

Reusable Components: `<MeetingScheduler/>`, `<RCReviewPanel/>`

---

## 5.6 Steering Committee Meeting Manager

### Workflow
- Week 3 (Oct): Auto-schedules Steering Committee meeting.
- Invites all required attendees (Chair, Co-Chair, EM, Past Chairs, RC).
- Displays ranked candidates list during meeting.
- Vote capture via system (each member selects top 3 choices).
- Auto-calculates consensus ranking.

Reusable Components: `<MeetingScheduler/>`, `<ConsensusBuilder/>`

---

## 5.7 Candidate Approach Workflow

### Process
- Post-meeting, system guides outreach process:
  - Approach #1 candidate → log outcome: Accepted / Declined / Needs Time.
  - If declined → auto-switch to next candidate.
- Once accepted → triggers RC and National approval workflows.

Reusable Components: `<ApproachProtocol/>`, `<ApprovalRequest/>`

---

## 5.8 Succession Knowledge Base

### Functionality
- Archives past succession data (candidates, scores, feedback).
- Pattern insights: *“3+ years EC experience → 90% success rate as Co-Chair.”*
- Stores RC feedback and decision rationales.

Reusable Component: `<SuccessionOrchestrator/>`

---

## 5.9 Automation Triggers

| Scenario | Trigger | Action |
|-----------|----------|---------|
| Timeline Delay | Sept 15, no nominations | Daily reminder to leadership + RC escalation after 3 days |
| Low Response | Oct 12, <3 Past Chairs scored | Urgent reminder with phone contacts |
| Quorum Risk | Only 3 confirmed attendees for Steering | Alert EM to reschedule or add members |
| Eligibility Gap | Missing Leadership Academy | Alert Chair to request exception |
| Approval Delay | Candidate accepted, no RC approval in 3 days | Reminder to RC; escalate after 7 days |

---

## 5.10 Reusable Components Summary
**Forms:** `<CandidateNomination/>`, `<EligibilityCheck/>`, `<ScoringForm/>`, `<MeetingScheduler/>`, `<ApprovalRequest/>`  
**Displays:** `<SuccessionTimeline/>`, `<CandidateProfile/>`, `<ScoringMatrix/>`, `<RankingDashboard/>`, `<ProcessStatus/>`  
**Workflows:** `<SuccessionOrchestrator/>`, `<ConsensusBuilder/>`, `<ApproachProtocol/>`, `<ExceptionHandler/>`

---

_End of Module 5 – Succession & Leadership Pipeline_

