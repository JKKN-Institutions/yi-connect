# Module 9: Vertical Performance Tracker 📊

## Purpose
Enable vertical heads to plan, monitor, and report activities — with auto-tracking of KPIs and performance comparisons across verticals.

**Goal:** Replace manual Excel trackers with dynamic, real-time dashboards.

---

## 9.1 Vertical Planning Console

### Features
- Annual plan creation for each vertical (Masoom, Yuva, Health, etc.).
- Defines goals, KPIs, and budget per quarter.
- Auto-copies previous year’s plan for continuity.
- Editable fields with Chair/Co-Chair approval lock.

Reusable Components: `<VerticalPlanForm/>`, `<GoalInput/>`, `<KPISelector/>`, `<ApprovalLock/>`

---

## 9.2 Activity Tracking

### Process
- Every event auto-linked to a vertical (from Module 3).
- Tracks outcomes: beneficiaries, volunteers, hours, photos, reports.
- Auto-calculates KPI completion %.

**Example:** Masoom → Target 20 sessions, 15 completed (75%).

Reusable Components: `<ActivityList/>`, `<KPIProgressBar/>`, `<OutcomeSummary/>`

---

## 9.3 KPI Dashboard

### Features
- Displays each vertical’s KPIs vs actuals.
- Filters: Quarter, Chair, Project Type.
- Visuals: bar charts, gauges, leaderboards.
- Comparative mode → “Which vertical performed best this quarter?”

Reusable Components: `<KPIDashboard/>`, `<PerformanceGauge/>`, `<VerticalLeaderboard/>`

---

## 9.4 Impact Analytics

### Metrics
- Total beneficiaries reached.
- Total volunteer hours contributed.
- Average engagement per member.
- Cost per impact unit (₹ per student reached).

Visualized as heatmaps, trends, and pie charts.

Reusable Components: `<ImpactDashboard/>`, `<Heatmap/>`, `<TrendChart/>`

---

## 9.5 Chair Performance Review

### Features
- Auto-generates quarterly Chair Review Report.
- Pulls top achievements, pending actions, and improvement areas.
- Editable comments + download as PDF.

Reusable Components: `<ReviewReport/>`, `<ImprovementTracker/>`

---

## 9.6 Leaderboard & Recognition

### Logic
- Ranks verticals by KPI completion, engagement, and innovation.
- Chair view: summary dashboard of top performers.
- Auto-nominates best vertical for Take Pride Awards (Module 6).

Reusable Components: `<RecognitionEngine/>`, `<VerticalRankCard/>`

---

## 9.7 Integration with Financial & Event Modules

### Interlinking
- Pulls expense data from Module 4.
- Fetches event count and attendance from Module 3.
- Auto-calculates cost efficiency and participation ratio.

Reusable Components: `<DataIntegrator/>`, `<CrossModuleSync/>`

---

## 9.8 Automation Triggers

| Scenario | Trigger | Action |
|-----------|----------|---------|
| Target Missed | <70% KPI by quarter end | Alert Vertical Chair |
| Overachievement | >120% KPI | Highlight for recognition |
| Low Volunteer Hours | <5 avg hours/member | Send re-engagement reminder |
| Late Report Submission | >7 days after event | Notify EC |
| Annual Summary | Dec 31 | Auto-generate yearly report |

---

## 9.9 Reusable Components Summary
**Forms:** `<VerticalPlanForm/>`, `<GoalInput/>`, `<KPISelector/>`, `<ReviewReport/>`  
**Displays:** `<KPIDashboard/>`, `<PerformanceGauge/>`, `<VerticalLeaderboard/>`, `<ImpactDashboard/>`, `<TrendChart/>`  
**Workflows:** `<CrossModuleSync/>`, `<RecognitionEngine/>`, `<ImprovementTracker/>`

---

_End of Module 9 – Vertical Performance Tracker_

