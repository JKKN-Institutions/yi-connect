# Module 9: Vertical Performance Tracker - Implementation Plan

**Project:** Yi Connect - Chapter Management System
**Module:** Module 9 - Vertical Performance Tracker
**Created:** 2025-01-19
**Status:** Ready for Implementation
**Estimated Duration:** 2-3 weeks
**Priority:** HIGH (Phase 3 - Leadership & Integration)

---

## 📋 Executive Summary

### Purpose
Enable vertical heads (Masoom, Yuva, Health, Swavalamban, etc.) to plan, monitor, and report activities with auto-tracking of KPIs and performance comparisons across verticals. Replace manual Excel trackers with dynamic, real-time dashboards.

### Key Features
1. **Vertical Planning Console** - Annual plans with goals, KPIs, and quarterly budgets
2. **Activity Tracking** - Auto-link events to verticals, track outcomes
3. **KPI Dashboard** - Real-time KPI progress with charts and gauges
4. **Impact Analytics** - Beneficiaries, volunteer hours, cost per impact
5. **Chair Performance Reviews** - Quarterly auto-generated reports
6. **Leaderboard & Recognition** - Rank verticals, auto-nominate for awards
7. **Module Integration** - Pull data from Events (Module 3) and Finance (Module 4)
8. **Automation Triggers** - Alerts for targets missed/exceeded

### Integration Points
- **Module 3 (Events)**: Auto-link events to verticals, track attendance and outcomes
- **Module 4 (Finance)**: Link expenses to verticals, calculate cost efficiency
- **Module 6 (Awards)**: Auto-nominate high-performing verticals for Take Pride Awards

---

## 🎯 Critical Error Prevention Guidelines

### Common Next.js 16 Errors to AVOID

#### ❌ Error 1: Uncached data accessed outside of Suspense
**Problem:** Data fetching outside Suspense boundaries delays entire page rendering
**Solution:**
```tsx
// ✅ CORRECT - Wrap data fetching in Suspense
export default function VerticalsPage() {
  return (
    <div>
      <Suspense fallback={<LoadingSkeleton />}>
        <VerticalsList /> {/* This component fetches data */}
      </Suspense>
    </div>
  );
}
```

#### ❌ Error 2: Using cookies() inside 'use cache'
**Problem:** Next.js 16 doesn't allow dynamic data sources (cookies, headers) inside cached functions
**Solution:**
```typescript
// ❌ WRONG - Don't use 'use cache' with Supabase
'use cache';
export async function getVerticals() {
  const supabase = createClient(); // Uses cookies() internally
  // ...
}

// ✅ CORRECT - Use React cache() instead
import { cache } from 'react';
export const getVerticals = cache(async () => {
  const supabase = createClient(); // Uses cookies() - that's OK with React cache()
  // ...
});
```

#### ❌ Error 3: Synchronously accessing searchParams
**Problem:** In Next.js 16, searchParams is a Promise
**Solution:**
```tsx
// ❌ WRONG
export default function Page({ searchParams }: PageProps) {
  const category = searchParams.category; // Error!
}

// ✅ CORRECT - Method 1: Await in async component
async function PageContent({ searchParams }: { searchParams: Promise<{...}> }) {
  const params = await searchParams;
  const category = params.category; // ✅ Works!
}

// ✅ CORRECT - Method 2: Use React.use()
import { use } from 'react';
function PageContent({ searchParams }: { searchParams: Promise<{...}> }) {
  const params = use(searchParams);
  const category = params.category; // ✅ Works!
}
```

### Mandatory Patterns to Follow

#### 1. Data Layer Pattern (lib/data/vertical.ts)
```typescript
/**
 * Vertical Module Data Layer
 * Uses React cache() for request-level deduplication.
 * IMPORTANT: Not using 'use cache' because Supabase uses cookies()
 */
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getVerticals = cache(async (chapterId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verticals')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('is_active', true);

  if (error) throw error;
  return data;
});
```

#### 2. Page Component Pattern
```tsx
import { Suspense } from 'react';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default function VerticalsPage({ searchParams }: PageProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Header - No data fetching, no Suspense needed */}
      <PageHeader />

      {/* Analytics - Fetches data, needs Suspense */}
      <Suspense fallback={<AnalyticsSkeleton />}>
        <VerticalAnalytics />
      </Suspense>

      {/* Content - Fetches data + uses searchParams, needs Suspense */}
      <Suspense fallback={<ContentSkeleton />}>
        <VerticalContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Async component that handles searchParams
async function VerticalContent({
  searchParams
}: {
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const params = await searchParams; // ✅ Await the Promise
  const verticals = await getVerticals(params.search);

  return <div>{/* Render content */}</div>;
}
```

#### 3. Server Action Pattern
```typescript
'use server';

import { revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createVertical(data: CreateVerticalInput) {
  const supabase = await createClient();

  // Validation
  const validated = createVerticalSchema.parse(data);

  // Insert
  const { data: vertical, error } = await supabase
    .from('verticals')
    .insert(validated)
    .select()
    .single();

  if (error) throw error;

  // Cache invalidation
  revalidateTag('verticals');

  return { success: true, data: vertical };
}
```

---

## 🗄️ Database Schema Design

### Phase 1: Core Tables

#### Table 1: verticals (Master)
```sql
CREATE TABLE verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Masoom", "Yuva", "Health", "Swavalamban"
  slug VARCHAR(100) NOT NULL, -- "masoom", "yuva", "health"
  description TEXT,
  color VARCHAR(7), -- Hex color for UI: "#3B82F6"
  icon VARCHAR(50), -- Icon name: "heart", "users", "briefcase"
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chapter_id, slug)
);

CREATE INDEX idx_verticals_chapter_id ON verticals(chapter_id);
CREATE INDEX idx_verticals_slug ON verticals(slug);

COMMENT ON TABLE verticals IS 'Master table for vertical definitions (Masoom, Yuva, Health, etc.)';
```

#### Table 2: vertical_chairs (Leadership)
```sql
CREATE TABLE vertical_chairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('chair', 'co_chair')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  appointed_by UUID REFERENCES members(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vertical_id, member_id, start_date)
);

CREATE INDEX idx_vertical_chairs_vertical_id ON vertical_chairs(vertical_id);
CREATE INDEX idx_vertical_chairs_member_id ON vertical_chairs(member_id);

COMMENT ON TABLE vertical_chairs IS 'Chair and Co-Chair assignments for verticals';
```

#### Table 3: vertical_plans (Annual Planning)
```sql
CREATE TABLE vertical_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  plan_name VARCHAR(255) NOT NULL,
  vision TEXT,
  mission TEXT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'active', 'completed')),

  -- Quarterly budgets
  q1_budget NUMERIC(10,2) DEFAULT 0,
  q2_budget NUMERIC(10,2) DEFAULT 0,
  q3_budget NUMERIC(10,2) DEFAULT 0,
  q4_budget NUMERIC(10,2) DEFAULT 0,
  total_budget NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(q1_budget, 0) + COALESCE(q2_budget, 0) +
    COALESCE(q3_budget, 0) + COALESCE(q4_budget, 0)
  ) STORED,

  -- Approval workflow
  approved_by UUID REFERENCES members(id),
  approved_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ, -- Lock editing after approval

  -- Plan continuity
  copied_from_plan_id UUID REFERENCES vertical_plans(id),

  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year)
);

CREATE INDEX idx_vertical_plans_vertical_id ON vertical_plans(vertical_id);
CREATE INDEX idx_vertical_plans_fiscal_year ON vertical_plans(fiscal_year);

COMMENT ON TABLE vertical_plans IS 'Annual plans with goals, KPIs, and quarterly budgets';
```

#### Table 4: vertical_kpis (KPI Definitions)
```sql
CREATE TABLE vertical_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES vertical_plans(id) ON DELETE CASCADE,
  kpi_name VARCHAR(255) NOT NULL,
  kpi_description TEXT,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('count', 'percentage', 'amount', 'hours', 'score')),
  unit VARCHAR(50), -- "sessions", "beneficiaries", "hours", "₹", "%"

  -- Quarterly targets
  target_q1 NUMERIC(10,2) DEFAULT 0,
  target_q2 NUMERIC(10,2) DEFAULT 0,
  target_q3 NUMERIC(10,2) DEFAULT 0,
  target_q4 NUMERIC(10,2) DEFAULT 0,
  target_annual NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(target_q1, 0) + COALESCE(target_q2, 0) +
    COALESCE(target_q3, 0) + COALESCE(target_q4, 0)
  ) STORED,

  weight NUMERIC(5,2) DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_kpis_plan_id ON vertical_kpis(plan_id);

COMMENT ON TABLE vertical_kpis IS 'KPI definitions with quarterly targets and weights';
```

#### Table 5: vertical_kpi_actuals (KPI Progress)
```sql
CREATE TABLE vertical_kpi_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES vertical_kpis(id) ON DELETE CASCADE,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  actual_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  recorded_by UUID REFERENCES members(id),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  supporting_event_ids UUID[], -- Array of event IDs contributing to this KPI

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(kpi_id, quarter)
);

CREATE INDEX idx_vertical_kpi_actuals_kpi_id ON vertical_kpi_actuals(kpi_id);

COMMENT ON TABLE vertical_kpi_actuals IS 'Actual KPI values per quarter';
```

#### Table 6: vertical_members (Team Assignments)
```sql
CREATE TABLE vertical_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role_in_vertical VARCHAR(100), -- "Core Team", "Volunteer", "Mentor"
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date DATE,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, member_id)
);

CREATE INDEX idx_vertical_members_vertical_id ON vertical_members(vertical_id);
CREATE INDEX idx_vertical_members_member_id ON vertical_members(member_id);

COMMENT ON TABLE vertical_members IS 'Team member assignments to verticals';
```

#### Table 7: vertical_activities (Activity Tracking)
```sql
CREATE TABLE vertical_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  activity_date DATE NOT NULL,
  activity_title VARCHAR(255) NOT NULL,
  activity_type VARCHAR(50) CHECK (activity_type IN ('event', 'meeting', 'outreach', 'campaign', 'training', 'other')),
  description TEXT,

  -- Outcome metrics
  beneficiaries_count INT DEFAULT 0,
  volunteer_count INT DEFAULT 0,
  volunteer_hours NUMERIC(8,2) DEFAULT 0,
  cost_incurred NUMERIC(10,2) DEFAULT 0,
  photos_count INT DEFAULT 0,

  report_url TEXT,
  impact_summary TEXT,

  -- Auto-calculate quarter from date
  quarter INT GENERATED ALWAYS AS (
    CASE
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 1 AND 3 THEN 1
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 4 AND 6 THEN 2
      WHEN EXTRACT(MONTH FROM activity_date) BETWEEN 7 AND 9 THEN 3
      ELSE 4
    END
  ) STORED,

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_activities_vertical_id ON vertical_activities(vertical_id);
CREATE INDEX idx_vertical_activities_event_id ON vertical_activities(event_id);
CREATE INDEX idx_vertical_activities_date ON vertical_activities(activity_date);

COMMENT ON TABLE vertical_activities IS 'Activity logs with outcome tracking';
```

#### Table 8: vertical_performance_reviews (Chair Reviews)
```sql
CREATE TABLE vertical_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  review_type VARCHAR(20) DEFAULT 'quarterly' CHECK (review_type IN ('quarterly', 'annual', 'mid_year')),

  top_achievements TEXT[], -- Array of achievement descriptions
  pending_actions TEXT[],
  improvement_areas TEXT[],
  chair_comments TEXT,

  -- Auto-calculated scores
  kpi_completion_percentage NUMERIC(5,2),
  budget_utilization_percentage NUMERIC(5,2),
  engagement_score NUMERIC(5,2),
  innovation_score NUMERIC(5,2),
  overall_rating NUMERIC(5,2) CHECK (overall_rating >= 0 AND overall_rating <= 10),

  reviewed_by UUID REFERENCES members(id),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(vertical_id, fiscal_year, quarter)
);

CREATE INDEX idx_vertical_reviews_vertical_id ON vertical_performance_reviews(vertical_id);

COMMENT ON TABLE vertical_performance_reviews IS 'Quarterly performance reviews with auto-generated insights';
```

#### Table 9: vertical_achievements (Recognition)
```sql
CREATE TABLE vertical_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_id UUID NOT NULL REFERENCES verticals(id) ON DELETE CASCADE,
  achievement_title VARCHAR(255) NOT NULL,
  achievement_description TEXT,
  achievement_date DATE NOT NULL,
  achievement_type VARCHAR(50) CHECK (achievement_type IN ('kpi_exceeded', 'innovation', 'impact', 'partnership', 'recognition', 'other')),

  impact_metrics JSONB, -- Flexible JSON for various metrics
  is_highlighted BOOLEAN DEFAULT false,
  nominated_for_award BOOLEAN DEFAULT false,
  award_nomination_id UUID REFERENCES nominations(id),

  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vertical_achievements_vertical_id ON vertical_achievements(vertical_id);

COMMENT ON TABLE vertical_achievements IS 'Notable achievements for recognition and awards';
```

### Phase 2: Integration Alterations

#### Alter events table
```sql
ALTER TABLE events
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_events_vertical_id ON events(vertical_id);

COMMENT ON COLUMN events.vertical_id IS 'Link event to vertical for performance tracking';
```

#### Alter expenses table
```sql
ALTER TABLE expenses
ADD COLUMN vertical_id UUID REFERENCES verticals(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_vertical_id ON expenses(vertical_id);

COMMENT ON COLUMN expenses.vertical_id IS 'Link expense to vertical for cost tracking';
```

### Phase 3: Analytics Views

#### View 1: vertical_kpi_progress
```sql
CREATE VIEW vertical_kpi_progress AS
SELECT
  vk.id AS kpi_id,
  vk.plan_id,
  vp.vertical_id,
  v.name AS vertical_name,
  vp.fiscal_year,
  vk.kpi_name,
  vk.metric_type,
  vk.unit,
  vk.target_q1,
  vk.target_q2,
  vk.target_q3,
  vk.target_q4,
  vk.target_annual,
  COALESCE(vka_q1.actual_value, 0) AS actual_q1,
  COALESCE(vka_q2.actual_value, 0) AS actual_q2,
  COALESCE(vka_q3.actual_value, 0) AS actual_q3,
  COALESCE(vka_q4.actual_value, 0) AS actual_q4,
  (COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
   COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) AS actual_annual,
  CASE
    WHEN vk.target_annual > 0
    THEN ROUND(((COALESCE(vka_q1.actual_value, 0) + COALESCE(vka_q2.actual_value, 0) +
                 COALESCE(vka_q3.actual_value, 0) + COALESCE(vka_q4.actual_value, 0)) / vk.target_annual * 100), 2)
    ELSE 0
  END AS completion_percentage
FROM vertical_kpis vk
JOIN vertical_plans vp ON vk.plan_id = vp.id
JOIN verticals v ON vp.vertical_id = v.id
LEFT JOIN vertical_kpi_actuals vka_q1 ON vk.id = vka_q1.kpi_id AND vka_q1.quarter = 1
LEFT JOIN vertical_kpi_actuals vka_q2 ON vk.id = vka_q2.kpi_id AND vka_q2.quarter = 2
LEFT JOIN vertical_kpi_actuals vka_q3 ON vk.id = vka_q3.kpi_id AND vka_q3.quarter = 3
LEFT JOIN vertical_kpi_actuals vka_q4 ON vk.id = vka_q4.kpi_id AND vka_q4.quarter = 4
WHERE vk.is_active = true;

COMMENT ON VIEW vertical_kpi_progress IS 'Real-time KPI progress tracking with completion percentages';
```

#### View 2: vertical_impact_metrics
```sql
CREATE VIEW vertical_impact_metrics AS
SELECT
  v.id AS vertical_id,
  v.name AS vertical_name,
  v.chapter_id,
  EXTRACT(YEAR FROM va.activity_date)::INT AS year,
  COUNT(DISTINCT va.id) AS total_activities,
  COUNT(DISTINCT va.event_id) AS total_events,
  SUM(va.beneficiaries_count) AS total_beneficiaries,
  SUM(va.volunteer_hours) AS total_volunteer_hours,
  SUM(va.cost_incurred) AS total_cost,
  CASE
    WHEN SUM(va.beneficiaries_count) > 0
    THEN ROUND(SUM(va.cost_incurred) / SUM(va.beneficiaries_count), 2)
    ELSE 0
  END AS cost_per_beneficiary,
  COUNT(DISTINCT vm.member_id) AS team_size,
  CASE
    WHEN COUNT(DISTINCT vm.member_id) > 0
    THEN ROUND(SUM(va.volunteer_hours) / COUNT(DISTINCT vm.member_id), 2)
    ELSE 0
  END AS avg_hours_per_member
FROM verticals v
LEFT JOIN vertical_activities va ON v.id = va.vertical_id
LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
WHERE v.is_active = true
GROUP BY v.id, v.name, v.chapter_id, EXTRACT(YEAR FROM va.activity_date);

COMMENT ON VIEW vertical_impact_metrics IS 'Impact analytics per vertical with cost efficiency metrics';
```

### Phase 4: Database Functions

#### Function 1: calculate_vertical_ranking
```sql
CREATE OR REPLACE FUNCTION calculate_vertical_ranking(
  p_chapter_id UUID,
  p_fiscal_year INT,
  p_quarter INT DEFAULT NULL
)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_score NUMERIC,
  engagement_score NUMERIC,
  innovation_score NUMERIC,
  total_score NUMERIC,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH vertical_scores AS (
    SELECT
      v.id AS vertical_id,
      v.name AS vertical_name,
      -- KPI Score: Average KPI completion percentage (weighted 50%)
      COALESCE(AVG(
        CASE
          WHEN vkp.target_annual > 0
          THEN (vkp.actual_annual / vkp.target_annual) * 100
          ELSE 0
        END
      ), 0) AS kpi_score,
      -- Engagement Score: Volunteer hours per member (weighted 30%)
      COALESCE(
        (SUM(va.volunteer_hours) / NULLIF(COUNT(DISTINCT vm.member_id), 0)) * 10, 0
      ) AS engagement_score,
      -- Innovation Score: From performance reviews (weighted 20%)
      COALESCE(AVG(vpr.innovation_score), 0) * 10 AS innovation_score
    FROM verticals v
    LEFT JOIN vertical_plans vp ON v.id = vp.vertical_id AND vp.fiscal_year = p_fiscal_year
    LEFT JOIN vertical_kpi_progress vkp ON vp.id = vkp.plan_id
    LEFT JOIN vertical_activities va ON v.id = va.vertical_id
      AND EXTRACT(YEAR FROM va.activity_date) = p_fiscal_year
      AND (p_quarter IS NULL OR va.quarter = p_quarter)
    LEFT JOIN vertical_members vm ON v.id = vm.vertical_id AND vm.is_active = true
    LEFT JOIN vertical_performance_reviews vpr ON v.id = vpr.vertical_id
      AND vpr.fiscal_year = p_fiscal_year
      AND (p_quarter IS NULL OR vpr.quarter = p_quarter)
    WHERE v.chapter_id = p_chapter_id AND v.is_active = true
    GROUP BY v.id, v.name
  )
  SELECT
    vs.vertical_id,
    vs.vertical_name,
    ROUND(vs.kpi_score, 2),
    ROUND(vs.engagement_score, 2),
    ROUND(vs.innovation_score, 2),
    ROUND((vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2), 2) AS total_score,
    RANK() OVER (ORDER BY (vs.kpi_score * 0.5 + vs.engagement_score * 0.3 + vs.innovation_score * 0.2) DESC) AS rank
  FROM vertical_scores vs
  ORDER BY total_score DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_vertical_ranking IS 'Calculate vertical rankings based on KPI completion, engagement, and innovation';
```

#### Function 2: check_kpi_alerts
```sql
CREATE OR REPLACE FUNCTION check_kpi_alerts(p_chapter_id UUID DEFAULT NULL)
RETURNS TABLE (
  vertical_id UUID,
  vertical_name VARCHAR,
  kpi_name VARCHAR,
  target NUMERIC,
  actual NUMERIC,
  completion_percentage NUMERIC,
  alert_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    vkp.kpi_name,
    vkp.target_annual,
    vkp.actual_annual,
    vkp.completion_percentage,
    CASE
      WHEN vkp.completion_percentage < 70 THEN 'target_missed'
      WHEN vkp.completion_percentage > 120 THEN 'overachievement'
      ELSE 'on_track'
    END AS alert_type
  FROM vertical_kpi_progress vkp
  JOIN verticals v ON vkp.vertical_id = v.id
  WHERE v.is_active = true
    AND vkp.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND (p_chapter_id IS NULL OR v.chapter_id = p_chapter_id)
    AND (vkp.completion_percentage < 70 OR vkp.completion_percentage > 120);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_kpi_alerts IS 'Check for KPIs that missed targets (<70%) or exceeded targets (>120%)';
```

### Phase 5: Automation Triggers

#### Trigger 1: Auto-create vertical_activity from completed event
```sql
CREATE OR REPLACE FUNCTION auto_create_vertical_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_volunteer_hours NUMERIC;
  v_created_by UUID;
BEGIN
  IF NEW.vertical_id IS NOT NULL AND NEW.status = 'completed' THEN
    -- Calculate total volunteer hours for this event
    SELECT COALESCE(SUM(hours_contributed), 0) INTO v_volunteer_hours
    FROM event_volunteers
    WHERE event_id = NEW.id AND status = 'completed';

    -- Get the creator of the event
    SELECT organizer_id INTO v_created_by FROM events WHERE id = NEW.id LIMIT 1;

    -- Insert activity record (ON CONFLICT DO NOTHING prevents duplicates)
    INSERT INTO vertical_activities (
      vertical_id,
      event_id,
      activity_date,
      activity_title,
      activity_type,
      description,
      beneficiaries_count,
      volunteer_hours,
      cost_incurred,
      created_by
    )
    VALUES (
      NEW.vertical_id,
      NEW.id,
      NEW.start_date::date,
      NEW.title,
      'event',
      NEW.description,
      NEW.current_registrations,
      v_volunteer_hours,
      COALESCE(NEW.actual_expense, 0),
      v_created_by
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_completed_create_activity
AFTER UPDATE ON events
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION auto_create_vertical_activity();

COMMENT ON FUNCTION auto_create_vertical_activity IS 'Automatically create vertical_activity when event is completed';
```

#### Trigger 2: Update timestamp
```sql
CREATE TRIGGER update_verticals_updated_at
BEFORE UPDATE ON verticals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_plans_updated_at
BEFORE UPDATE ON vertical_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_kpis_updated_at
BEFORE UPDATE ON vertical_kpis
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_kpi_actuals_updated_at
BEFORE UPDATE ON vertical_kpi_actuals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_members_updated_at
BEFORE UPDATE ON vertical_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_activities_updated_at
BEFORE UPDATE ON vertical_activities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_reviews_updated_at
BEFORE UPDATE ON vertical_performance_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_vertical_chairs_updated_at
BEFORE UPDATE ON vertical_chairs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
```

### Phase 6: RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_kpi_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_achievements ENABLE ROW LEVEL SECURITY;

-- verticals: Read by chapter members, write by EC/Chair
CREATE POLICY verticals_select_policy ON verticals
  FOR SELECT USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
  );

CREATE POLICY verticals_insert_policy ON verticals
  FOR INSERT WITH CHECK (
    user_belongs_to_chapter(chapter_id)
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_update_policy ON verticals
  FOR UPDATE USING (
    chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    AND get_user_hierarchy_level() >= 3
  );

CREATE POLICY verticals_delete_policy ON verticals
  FOR DELETE USING (
    get_user_hierarchy_level() >= 4
  );

-- vertical_plans: Read by chapter members, write by vertical chairs/EC
CREATE POLICY vertical_plans_select_policy ON vertical_plans
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_plans_insert_policy ON vertical_plans
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

CREATE POLICY vertical_plans_update_policy ON vertical_plans
  FOR UPDATE USING (
    (vertical_id IN (
      SELECT vertical_id FROM vertical_chairs
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    ) AND locked_at IS NULL)
    OR get_user_hierarchy_level() >= 3
  );

-- vertical_activities: Read by all, write by vertical members/chairs
CREATE POLICY vertical_activities_select_policy ON vertical_activities
  FOR SELECT USING (
    vertical_id IN (
      SELECT id FROM verticals
      WHERE chapter_id IN (SELECT chapter_id FROM members WHERE id = (SELECT id FROM auth.users WHERE auth.uid() = id))
    )
  );

CREATE POLICY vertical_activities_insert_policy ON vertical_activities
  FOR INSERT WITH CHECK (
    vertical_id IN (
      SELECT vertical_id FROM vertical_members
      WHERE member_id = (SELECT id FROM auth.users WHERE auth.uid() = id) AND is_active = true
    )
    OR get_user_hierarchy_level() >= 3
  );

-- Similar policies for other tables...
-- (Following the same pattern: read by chapter members, write by vertical members/chairs/EC)
```

---

## 📁 Implementation Phases

### Phase 1: Database Foundation (Day 1-2)
**Estimated Time:** 4-6 hours

#### Step 1.1: Create Migration File
```bash
# Create migration file
npx supabase migration new vertical_performance_tracker
```

#### Step 1.2: Apply Migration
Copy the complete schema SQL from above into the migration file, then:
```bash
# Apply migration to local Supabase
npx supabase db push

# Or use MCP tool
# mcp__supabase__apply_migration with name: vertical_performance_tracker
```

#### Step 1.3: Verify Tables
```sql
-- Check all tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'vertical%'
ORDER BY table_name;

-- Verify views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'vertical%';

-- Verify functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%vertical%';
```

#### Step 1.4: Generate TypeScript Types
```bash
# Generate types
npx supabase gen types typescript --project-id=jxvbjpkypzedtrqewesc > types/database.ts

# Or use MCP tool
# mcp__supabase__generate_typescript_types
```

#### Step 1.5: Seed Sample Data (Optional for Testing)
```sql
-- Insert sample verticals for testing
INSERT INTO verticals (chapter_id, name, slug, description, color, icon, display_order)
SELECT
  id,
  'Masoom',
  'masoom',
  'Children welfare and education programs',
  '#3B82F6',
  'baby',
  1
FROM chapters LIMIT 1;

INSERT INTO verticals (chapter_id, name, slug, description, color, icon, display_order)
SELECT
  id,
  'Yuva',
  'yuva',
  'Youth development and skill training',
  '#10B981',
  'users',
  2
FROM chapters LIMIT 1;

-- Verify
SELECT * FROM verticals;
```

**Deliverables:**
- ✅ Migration file created and applied
- ✅ 9 core tables created
- ✅ 2 views created
- ✅ 2+ functions created
- ✅ RLS policies enabled
- ✅ TypeScript types generated
- ✅ Sample data inserted (optional)

---

### Phase 2: TypeScript Types (Day 2-3)
**Estimated Time:** 4-6 hours

#### File: `types/vertical.ts`

```typescript
import type { Database } from './database';

// ============================================================================
// Database Row Types
// ============================================================================

export type Vertical = Database['public']['Tables']['verticals']['Row'];
export type VerticalInsert = Database['public']['Tables']['verticals']['Insert'];
export type VerticalUpdate = Database['public']['Tables']['verticals']['Update'];

export type VerticalChair = Database['public']['Tables']['vertical_chairs']['Row'];
export type VerticalChairInsert = Database['public']['Tables']['vertical_chairs']['Insert'];
export type VerticalChairUpdate = Database['public']['Tables']['vertical_chairs']['Update'];

export type VerticalPlan = Database['public']['Tables']['vertical_plans']['Row'];
export type VerticalPlanInsert = Database['public']['Tables']['vertical_plans']['Insert'];
export type VerticalPlanUpdate = Database['public']['Tables']['vertical_plans']['Update'];

export type VerticalKPI = Database['public']['Tables']['vertical_kpis']['Row'];
export type VerticalKPIInsert = Database['public']['Tables']['vertical_kpis']['Insert'];
export type VerticalKPIUpdate = Database['public']['Tables']['vertical_kpis']['Update'];

export type VerticalKPIActual = Database['public']['Tables']['vertical_kpi_actuals']['Row'];
export type VerticalKPIActualInsert = Database['public']['Tables']['vertical_kpi_actuals']['Insert'];
export type VerticalKPIActualUpdate = Database['public']['Tables']['vertical_kpi_actuals']['Update'];

export type VerticalMember = Database['public']['Tables']['vertical_members']['Row'];
export type VerticalMemberInsert = Database['public']['Tables']['vertical_members']['Insert'];
export type VerticalMemberUpdate = Database['public']['Tables']['vertical_members']['Update'];

export type VerticalActivity = Database['public']['Tables']['vertical_activities']['Row'];
export type VerticalActivityInsert = Database['public']['Tables']['vertical_activities']['Insert'];
export type VerticalActivityUpdate = Database['public']['Tables']['vertical_activities']['Update'];

export type VerticalPerformanceReview = Database['public']['Tables']['vertical_performance_reviews']['Row'];
export type VerticalPerformanceReviewInsert = Database['public']['Tables']['vertical_performance_reviews']['Insert'];
export type VerticalPerformanceReviewUpdate = Database['public']['Tables']['vertical_performance_reviews']['Update'];

export type VerticalAchievement = Database['public']['Tables']['vertical_achievements']['Row'];
export type VerticalAchievementInsert = Database['public']['Tables']['vertical_achievements']['Insert'];
export type VerticalAchievementUpdate = Database['public']['Tables']['vertical_achievements']['Update'];

// ============================================================================
// Extended Types with Relations
// ============================================================================

export interface VerticalWithChair extends Vertical {
  current_chair: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  current_co_chair: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
  team_size: number;
}

export interface VerticalPlanWithKPIs extends VerticalPlan {
  vertical: Pick<Vertical, 'id' | 'name' | 'slug' | 'color' | 'icon'>;
  kpis: VerticalKPIWithProgress[];
  created_by_member: {
    id: string;
    full_name: string;
  };
}

export interface VerticalKPIWithProgress extends VerticalKPI {
  actuals: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    annual: number;
  };
  completion_percentage: number;
  status: 'on_track' | 'behind' | 'exceeded';
}

export interface VerticalActivityWithDetails extends VerticalActivity {
  vertical: Pick<Vertical, 'id' | 'name' | 'color' | 'icon'>;
  event: {
    id: string;
    title: string;
    category: string;
  } | null;
  created_by_member: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export interface VerticalPerformanceReviewWithDetails extends VerticalPerformanceReview {
  vertical: Pick<Vertical, 'id' | 'name' | 'color' | 'icon'>;
  reviewed_by_member: {
    id: string;
    full_name: string;
  } | null;
}

// ============================================================================
// Dashboard & Analytics Types
// ============================================================================

export interface VerticalDashboardSummary {
  vertical: VerticalWithChair;
  current_plan: VerticalPlan | null;
  kpi_summary: {
    total_kpis: number;
    on_track: number;
    behind: number;
    exceeded: number;
    avg_completion: number;
  };
  impact_metrics: {
    total_activities: number;
    total_events: number;
    total_beneficiaries: number;
    total_volunteer_hours: number;
    total_cost: number;
    cost_per_beneficiary: number;
  };
  team_metrics: {
    team_size: number;
    active_members: number;
    avg_hours_per_member: number;
  };
  recent_achievements: VerticalAchievement[];
}

export interface VerticalRanking {
  vertical_id: string;
  vertical_name: string;
  kpi_score: number;
  engagement_score: number;
  innovation_score: number;
  total_score: number;
  rank: number;
}

export interface VerticalComparison {
  verticals: Array<{
    id: string;
    name: string;
    color: string;
    kpi_completion: number;
    beneficiaries: number;
    volunteer_hours: number;
    budget_utilization: number;
  }>;
  fiscal_year: number;
  quarter: number | null;
}

export interface KPIAlert {
  vertical_id: string;
  vertical_name: string;
  kpi_name: string;
  target: number;
  actual: number;
  completion_percentage: number;
  alert_type: 'target_missed' | 'overachievement' | 'on_track';
}

// ============================================================================
// Filter & Sort Types
// ============================================================================

export interface VerticalFilters {
  search?: string;
  is_active?: boolean;
  chapter_id?: string;
}

export interface VerticalPlanFilters {
  fiscal_year?: number;
  status?: VerticalPlan['status'];
  vertical_id?: string;
}

export interface VerticalActivityFilters {
  vertical_id?: string;
  activity_type?: VerticalActivity['activity_type'];
  date_from?: string;
  date_to?: string;
  quarter?: number;
  year?: number;
}

export type VerticalSortField = 'name' | 'created_at' | 'team_size';
export type VerticalSortOrder = 'asc' | 'desc';

export interface VerticalSortOptions {
  field: VerticalSortField;
  order: VerticalSortOrder;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginatedVerticals {
  verticals: VerticalWithChair[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedActivities {
  activities: VerticalActivityWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Constants
// ============================================================================

export const VERTICAL_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
] as const;

export const PLAN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' }
] as const;

export const METRIC_TYPES = [
  { value: 'count', label: 'Count' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'amount', label: 'Amount (₹)' },
  { value: 'hours', label: 'Hours' },
  { value: 'score', label: 'Score' }
] as const;

export const ACTIVITY_TYPES = [
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' }
] as const;

export const ACHIEVEMENT_TYPES = [
  { value: 'kpi_exceeded', label: 'KPI Exceeded' },
  { value: 'innovation', label: 'Innovation' },
  { value: 'impact', label: 'Impact' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'recognition', label: 'Recognition' },
  { value: 'other', label: 'Other' }
] as const;

export const CHAIR_ROLES = [
  { value: 'chair', label: 'Chair' },
  { value: 'co_chair', label: 'Co-Chair' }
] as const;

export const QUARTERS = [
  { value: 1, label: 'Q1 (Jan-Mar)' },
  { value: 2, label: 'Q2 (Apr-Jun)' },
  { value: 3, label: 'Q3 (Jul-Sep)' },
  { value: 4, label: 'Q4 (Oct-Dec)' }
] as const;
```

**Deliverables:**
- ✅ Complete TypeScript types with database row types
- ✅ Extended types with relations
- ✅ Dashboard and analytics types
- ✅ Filter and sort types
- ✅ Pagination types
- ✅ Constants and enums

---

### Phase 3: Validation Schemas (Day 3-4)
**Estimated Time:** 3-4 hours

#### File: `lib/validations/vertical.ts`

```typescript
import { z } from 'zod';

// ============================================================================
// Vertical Schemas
// ============================================================================

export const createVerticalSchema = z.object({
  chapter_id: z.string().uuid('Invalid chapter ID'),
  name: z.string()
    .min(2, 'Vertical name must be at least 2 characters')
    .max(100, 'Vertical name must be less than 100 characters'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
    .optional(),
  icon: z.string().max(50).optional(),
  display_order: z.number().int().min(0).default(0)
});

export const updateVerticalSchema = createVerticalSchema.partial().extend({
  id: z.string().uuid('Invalid vertical ID')
});

// ============================================================================
// Vertical Plan Schemas
// ============================================================================

export const createVerticalPlanSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  fiscal_year: z.number()
    .int()
    .min(2020, 'Fiscal year must be 2020 or later')
    .max(2100, 'Fiscal year must be 2100 or earlier'),
  plan_name: z.string()
    .min(3, 'Plan name must be at least 3 characters')
    .max(255, 'Plan name must be less than 255 characters'),
  vision: z.string().optional(),
  mission: z.string().optional(),
  q1_budget: z.number().min(0, 'Budget cannot be negative').optional(),
  q2_budget: z.number().min(0, 'Budget cannot be negative').optional(),
  q3_budget: z.number().min(0, 'Budget cannot be negative').optional(),
  q4_budget: z.number().min(0, 'Budget cannot be negative').optional(),
  created_by: z.string().uuid('Invalid user ID')
});

export const updateVerticalPlanSchema = createVerticalPlanSchema.partial().extend({
  id: z.string().uuid('Invalid plan ID')
});

export const approveVerticalPlanSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
  approved_by: z.string().uuid('Invalid approver ID')
});

// ============================================================================
// KPI Schemas
// ============================================================================

export const createVerticalKPISchema = z.object({
  plan_id: z.string().uuid('Invalid plan ID'),
  kpi_name: z.string()
    .min(3, 'KPI name must be at least 3 characters')
    .max(255, 'KPI name must be less than 255 characters'),
  kpi_description: z.string().optional(),
  metric_type: z.enum(['count', 'percentage', 'amount', 'hours', 'score']),
  unit: z.string().max(50).optional(),
  target_q1: z.number().min(0, 'Target cannot be negative').optional(),
  target_q2: z.number().min(0, 'Target cannot be negative').optional(),
  target_q3: z.number().min(0, 'Target cannot be negative').optional(),
  target_q4: z.number().min(0, 'Target cannot be negative').optional(),
  weight: z.number()
    .min(0, 'Weight must be between 0 and 100')
    .max(100, 'Weight must be between 0 and 100')
    .default(10),
  display_order: z.number().int().min(0).default(0)
});

export const updateVerticalKPISchema = createVerticalKPISchema.partial().extend({
  id: z.string().uuid('Invalid KPI ID')
});

// ============================================================================
// KPI Actual Schemas
// ============================================================================

export const recordKPIActualSchema = z.object({
  kpi_id: z.string().uuid('Invalid KPI ID'),
  quarter: z.number().int().min(1, 'Quarter must be 1-4').max(4, 'Quarter must be 1-4'),
  actual_value: z.number().min(0, 'Actual value cannot be negative'),
  notes: z.string().optional(),
  supporting_event_ids: z.array(z.string().uuid()).optional(),
  recorded_by: z.string().uuid('Invalid user ID')
});

export const updateKPIActualSchema = recordKPIActualSchema.partial().extend({
  id: z.string().uuid('Invalid actual ID')
});

// ============================================================================
// Vertical Chair Schemas
// ============================================================================

export const assignVerticalChairSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  member_id: z.string().uuid('Invalid member ID'),
  role: z.enum(['chair', 'co_chair']),
  start_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format'
  }),
  end_date: z.string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid end date format'
    })
    .optional(),
  appointed_by: z.string().uuid('Invalid appointer ID'),
  notes: z.string().optional()
});

export const updateVerticalChairSchema = assignVerticalChairSchema.partial().extend({
  id: z.string().uuid('Invalid chair assignment ID')
});

// ============================================================================
// Vertical Member Schemas
// ============================================================================

export const addVerticalMemberSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  member_id: z.string().uuid('Invalid member ID'),
  role_in_vertical: z.string().max(100).optional(),
  joined_date: z.string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid joined date format'
    })
    .optional()
});

export const updateVerticalMemberSchema = addVerticalMemberSchema.partial().extend({
  id: z.string().uuid('Invalid member assignment ID'),
  left_date: z.string()
    .refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid left date format'
    })
    .optional()
});

// ============================================================================
// Activity Schemas
// ============================================================================

export const createVerticalActivitySchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  event_id: z.string().uuid('Invalid event ID').optional(),
  activity_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid activity date format'
  }),
  activity_title: z.string()
    .min(3, 'Activity title must be at least 3 characters')
    .max(255, 'Activity title must be less than 255 characters'),
  activity_type: z.enum(['event', 'meeting', 'outreach', 'campaign', 'training', 'other']).optional(),
  description: z.string().optional(),
  beneficiaries_count: z.number().int().min(0, 'Count cannot be negative').default(0),
  volunteer_count: z.number().int().min(0, 'Count cannot be negative').default(0),
  volunteer_hours: z.number().min(0, 'Hours cannot be negative').default(0),
  cost_incurred: z.number().min(0, 'Cost cannot be negative').default(0),
  photos_count: z.number().int().min(0, 'Count cannot be negative').default(0),
  report_url: z.string().url('Invalid URL format').optional(),
  impact_summary: z.string().optional(),
  created_by: z.string().uuid('Invalid user ID')
});

export const updateVerticalActivitySchema = createVerticalActivitySchema.partial().extend({
  id: z.string().uuid('Invalid activity ID')
});

// ============================================================================
// Performance Review Schemas
// ============================================================================

export const createPerformanceReviewSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  fiscal_year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
  review_type: z.enum(['quarterly', 'annual', 'mid_year']).default('quarterly'),
  top_achievements: z.array(z.string()).optional(),
  pending_actions: z.array(z.string()).optional(),
  improvement_areas: z.array(z.string()).optional(),
  chair_comments: z.string().optional(),
  kpi_completion_percentage: z.number().min(0).max(200).optional(),
  budget_utilization_percentage: z.number().min(0).max(200).optional(),
  engagement_score: z.number().min(0).max(10).optional(),
  innovation_score: z.number().min(0).max(10).optional(),
  overall_rating: z.number().min(0).max(10).optional(),
  reviewed_by: z.string().uuid('Invalid reviewer ID')
});

export const updatePerformanceReviewSchema = createPerformanceReviewSchema.partial().extend({
  id: z.string().uuid('Invalid review ID')
});

// ============================================================================
// Achievement Schemas
// ============================================================================

export const createAchievementSchema = z.object({
  vertical_id: z.string().uuid('Invalid vertical ID'),
  achievement_title: z.string()
    .min(3, 'Achievement title must be at least 3 characters')
    .max(255, 'Achievement title must be less than 255 characters'),
  achievement_description: z.string().optional(),
  achievement_date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid achievement date format'
  }),
  achievement_type: z.enum(['kpi_exceeded', 'innovation', 'impact', 'partnership', 'recognition', 'other']).optional(),
  impact_metrics: z.record(z.any()).optional(),
  is_highlighted: z.boolean().default(false),
  created_by: z.string().uuid('Invalid user ID')
});

export const updateAchievementSchema = createAchievementSchema.partial().extend({
  id: z.string().uuid('Invalid achievement ID')
});

// ============================================================================
// Filter Schemas
// ============================================================================

export const verticalFiltersSchema = z.object({
  search: z.string().optional(),
  is_active: z.boolean().optional(),
  chapter_id: z.string().uuid().optional()
});

export const verticalPlanFiltersSchema = z.object({
  fiscal_year: z.number().int().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'active', 'completed']).optional(),
  vertical_id: z.string().uuid().optional()
});

export const activityFiltersSchema = z.object({
  vertical_id: z.string().uuid().optional(),
  activity_type: z.enum(['event', 'meeting', 'outreach', 'campaign', 'training', 'other']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  year: z.number().int().optional()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateVerticalInput = z.infer<typeof createVerticalSchema>;
export type UpdateVerticalInput = z.infer<typeof updateVerticalSchema>;
export type CreateVerticalPlanInput = z.infer<typeof createVerticalPlanSchema>;
export type UpdateVerticalPlanInput = z.infer<typeof updateVerticalPlanSchema>;
export type CreateVerticalKPIInput = z.infer<typeof createVerticalKPISchema>;
export type UpdateVerticalKPIInput = z.infer<typeof updateVerticalKPISchema>;
export type RecordKPIActualInput = z.infer<typeof recordKPIActualSchema>;
export type AssignVerticalChairInput = z.infer<typeof assignVerticalChairSchema>;
export type AddVerticalMemberInput = z.infer<typeof addVerticalMemberSchema>;
export type CreateVerticalActivityInput = z.infer<typeof createVerticalActivitySchema>;
export type UpdateVerticalActivityInput = z.infer<typeof updateVerticalActivitySchema>;
export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;
```

**Deliverables:**
- ✅ Complete Zod validation schemas for all CRUD operations
- ✅ Input type exports from Zod schemas
- ✅ Comprehensive validation rules with helpful error messages

---

### Phase 4: Data Layer with React cache() (Day 4-6)
**Estimated Time:** 8-10 hours

#### File: `lib/data/vertical.ts`

```typescript
/**
 * Vertical Performance Module Data Layer
 *
 * Cached data fetching functions for Vertical Performance Tracker module.
 * Uses React cache() for request-level deduplication.
 *
 * IMPORTANT: We don't use Next.js 16's 'use cache' directive here because
 * all functions access Supabase client which uses cookies() - a dynamic data source.
 * Next.js 16 doesn't allow dynamic data sources inside 'use cache' boundaries.
 * React's cache() provides request-level deduplication which is sufficient.
 */

import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/data/auth';
import type {
  Vertical,
  VerticalWithChair,
  VerticalPlan,
  VerticalPlanWithKPIs,
  VerticalKPI,
  VerticalKPIWithProgress,
  VerticalActivity,
  VerticalActivityWithDetails,
  VerticalPerformanceReview,
  VerticalPerformanceReviewWithDetails,
  VerticalAchievement,
  VerticalDashboardSummary,
  VerticalRanking,
  VerticalComparison,
  KPIAlert,
  VerticalFilters,
  VerticalPlanFilters,
  VerticalActivityFilters,
  PaginatedVerticals,
  PaginatedActivities
} from '@/types/vertical';

// ============================================================================
// Vertical Queries
// ============================================================================

/**
 * Get all verticals for a chapter with current chair info
 */
export const getVerticals = cache(async (
  chapterId: string,
  filters?: VerticalFilters
): Promise<VerticalWithChair[]> => {
  const supabase = await createClient();

  let query = supabase
    .from('verticals')
    .select(`
      *,
      current_chair:vertical_chairs!left(
        id,
        member:members(id, full_name, email, avatar_url)
      ),
      current_co_chair:vertical_chairs!left(
        id,
        member:members(id, full_name, email, avatar_url)
      )
    `)
    .eq('chapter_id', chapterId)
    .order('display_order', { ascending: true });

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform data to include chair info and team size
  return data as any; // Type assertion needed due to complex join
});

/**
 * Get a single vertical by ID with full details
 */
export const getVerticalById = cache(async (id: string): Promise<VerticalWithChair | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('verticals')
    .select(`
      *,
      current_chair:vertical_chairs!left(
        id,
        member:members(id, full_name, email, avatar_url)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as any;
});

/**
 * Get vertical by slug
 */
export const getVerticalBySlug = cache(async (
  chapterId: string,
  slug: string
): Promise<VerticalWithChair | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('verticals')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data as any;
});

// ============================================================================
// Vertical Plan Queries
// ============================================================================

/**
 * Get all vertical plans with filters
 */
export const getVerticalPlans = cache(async (
  filters?: VerticalPlanFilters
): Promise<VerticalPlanWithKPIs[]> => {
  const supabase = await createClient();

  let query = supabase
    .from('vertical_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      kpis:vertical_kpis(*),
      created_by_member:members!created_by(id, full_name)
    `)
    .order('fiscal_year', { ascending: false });

  if (filters?.fiscal_year) {
    query = query.eq('fiscal_year', filters.fiscal_year);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any;
});

/**
 * Get vertical plan by ID with KPIs
 */
export const getVerticalPlanById = cache(async (id: string): Promise<VerticalPlanWithKPIs | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vertical_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      kpis:vertical_kpis(*),
      created_by_member:members!created_by(id, full_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as any;
});

/**
 * Get active plan for a vertical
 */
export const getActiveVerticalPlan = cache(async (
  verticalId: string,
  fiscalYear?: number
): Promise<VerticalPlanWithKPIs | null> => {
  const supabase = await createClient();
  const year = fiscalYear || new Date().getFullYear();

  const { data, error } = await supabase
    .from('vertical_plans')
    .select(`
      *,
      vertical:verticals(id, name, slug, color, icon),
      kpis:vertical_kpis(*),
      created_by_member:members!created_by(id, full_name)
    `)
    .eq('vertical_id', verticalId)
    .eq('fiscal_year', year)
    .in('status', ['approved', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as any;
});

// ============================================================================
// KPI Progress Queries
// ============================================================================

/**
 * Get KPI progress for a plan
 */
export const getKPIProgress = cache(async (
  planId: string
): Promise<VerticalKPIWithProgress[]> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('vertical_kpi_progress')
    .select('*')
    .eq('plan_id', planId)
    .order('display_order', { ascending: true });

  if (error) throw error;

  // Transform to include status
  return data.map(kpi => ({
    ...kpi,
    status: getKPIStatus(kpi.completion_percentage)
  })) as any;
});

function getKPIStatus(completion: number): 'on_track' | 'behind' | 'exceeded' {
  if (completion < 70) return 'behind';
  if (completion > 120) return 'exceeded';
  return 'on_track';
}

// ============================================================================
// Activity Queries
// ============================================================================

/**
 * Get vertical activities with pagination
 */
export const getVerticalActivities = cache(async (
  filters?: VerticalActivityFilters,
  page = 1,
  pageSize = 20
): Promise<PaginatedActivities> => {
  const supabase = await createClient();

  let query = supabase
    .from('vertical_activities')
    .select(`
      *,
      vertical:verticals(id, name, color, icon),
      event:events(id, title, category),
      created_by_member:members!created_by(id, full_name, avatar_url)
    `, { count: 'exact' });

  // Apply filters
  if (filters?.vertical_id) {
    query = query.eq('vertical_id', filters.vertical_id);
  }

  if (filters?.activity_type) {
    query = query.eq('activity_type', filters.activity_type);
  }

  if (filters?.date_from) {
    query = query.gte('activity_date', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('activity_date', filters.date_to);
  }

  if (filters?.quarter) {
    query = query.eq('quarter', filters.quarter);
  }

  if (filters?.year) {
    query = query.gte('activity_date', `${filters.year}-01-01`)
      .lte('activity_date', `${filters.year}-12-31`);
  }

  // Pagination
  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);
  query = query.order('activity_date', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    activities: data as any,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  };
});

// ============================================================================
// Dashboard & Analytics Queries
// ============================================================================

/**
 * Get vertical dashboard summary
 */
export const getVerticalDashboard = cache(async (
  verticalId: string,
  fiscalYear?: number
): Promise<VerticalDashboardSummary> => {
  const supabase = await createClient();
  const year = fiscalYear || new Date().getFullYear();

  // Get vertical with chair
  const vertical = await getVerticalById(verticalId);
  if (!vertical) throw new Error('Vertical not found');

  // Get active plan
  const plan = await getActiveVerticalPlan(verticalId, year);

  // Get KPI summary
  const { data: kpiData } = await supabase
    .from('vertical_kpi_progress')
    .select('completion_percentage')
    .eq('vertical_id', verticalId)
    .eq('fiscal_year', year);

  const kpiSummary = {
    total_kpis: kpiData?.length || 0,
    on_track: kpiData?.filter(k => k.completion_percentage >= 70 && k.completion_percentage <= 120).length || 0,
    behind: kpiData?.filter(k => k.completion_percentage < 70).length || 0,
    exceeded: kpiData?.filter(k => k.completion_percentage > 120).length || 0,
    avg_completion: kpiData?.reduce((sum, k) => sum + k.completion_percentage, 0) / (kpiData?.length || 1) || 0
  };

  // Get impact metrics
  const { data: impactData } = await supabase
    .from('vertical_impact_metrics')
    .select('*')
    .eq('vertical_id', verticalId)
    .eq('year', year)
    .single();

  const impactMetrics = impactData || {
    total_activities: 0,
    total_events: 0,
    total_beneficiaries: 0,
    total_volunteer_hours: 0,
    total_cost: 0,
    cost_per_beneficiary: 0
  };

  // Get team metrics
  const { data: teamData, count: teamSize } = await supabase
    .from('vertical_members')
    .select('*', { count: 'exact' })
    .eq('vertical_id', verticalId)
    .eq('is_active', true);

  const teamMetrics = {
    team_size: teamSize || 0,
    active_members: teamSize || 0,
    avg_hours_per_member: impactMetrics.avg_hours_per_member || 0
  };

  // Get recent achievements
  const { data: achievements } = await supabase
    .from('vertical_achievements')
    .select('*')
    .eq('vertical_id', verticalId)
    .order('achievement_date', { ascending: false })
    .limit(5);

  return {
    vertical,
    current_plan: plan,
    kpi_summary: kpiSummary,
    impact_metrics: impactMetrics as any,
    team_metrics: teamMetrics,
    recent_achievements: achievements || []
  };
});

/**
 * Get vertical rankings
 */
export const getVerticalRankings = cache(async (
  chapterId: string,
  fiscalYear?: number,
  quarter?: number
): Promise<VerticalRanking[]> => {
  const supabase = await createClient();
  const year = fiscalYear || new Date().getFullYear();

  const { data, error } = await supabase.rpc('calculate_vertical_ranking', {
    p_chapter_id: chapterId,
    p_fiscal_year: year,
    p_quarter: quarter || null
  });

  if (error) throw error;
  return data;
});

/**
 * Get KPI alerts
 */
export const getKPIAlerts = cache(async (chapterId?: string): Promise<KPIAlert[]> => {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('check_kpi_alerts', {
    p_chapter_id: chapterId || null
  });

  if (error) throw error;
  return data;
});

/**
 * Get vertical comparison data
 */
export const getVerticalComparison = cache(async (
  chapterId: string,
  fiscalYear?: number,
  quarter?: number
): Promise<VerticalComparison> => {
  const supabase = await createClient();
  const year = fiscalYear || new Date().getFullYear();

  // Get all verticals with their metrics
  const { data: verticals } = await supabase
    .from('verticals')
    .select(`
      id,
      name,
      color,
      vertical_plans(
        fiscal_year,
        total_budget
      ),
      vertical_kpi_progress(
        completion_percentage
      ),
      vertical_impact_metrics(
        total_beneficiaries,
        total_volunteer_hours,
        total_cost
      )
    `)
    .eq('chapter_id', chapterId)
    .eq('is_active', true);

  if (!verticals) return { verticals: [], fiscal_year: year, quarter: quarter || null };

  // Transform data
  const comparison = verticals.map(v => ({
    id: v.id,
    name: v.name,
    color: v.color,
    kpi_completion: 0, // Calculate from vertical_kpi_progress
    beneficiaries: 0, // From vertical_impact_metrics
    volunteer_hours: 0, // From vertical_impact_metrics
    budget_utilization: 0 // Calculate from plan
  }));

  return {
    verticals: comparison,
    fiscal_year: year,
    quarter: quarter || null
  };
});

// ============================================================================
// Performance Review Queries
// ============================================================================

/**
 * Get performance reviews for a vertical
 */
export const getPerformanceReviews = cache(async (
  verticalId: string,
  fiscalYear?: number
): Promise<VerticalPerformanceReviewWithDetails[]> => {
  const supabase = await createClient();

  let query = supabase
    .from('vertical_performance_reviews')
    .select(`
      *,
      vertical:verticals(id, name, color, icon),
      reviewed_by_member:members!reviewed_by(id, full_name)
    `)
    .eq('vertical_id', verticalId)
    .order('fiscal_year', { ascending: false })
    .order('quarter', { ascending: false });

  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as any;
});
```

**Deliverables:**
- ✅ Complete data layer with React cache()
- ✅ Comprehensive query functions for all entities
- ✅ Dashboard and analytics queries
- ✅ Proper error handling
- ✅ Type-safe return values

---

*Continue in next message...*
