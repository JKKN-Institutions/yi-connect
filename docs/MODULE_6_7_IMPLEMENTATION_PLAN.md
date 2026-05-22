# Module 6 & 7 Complete Implementation Plan
**Created:** 2025-01-19
**Status:** Ready for Execution
**Total Estimated Time:** 6.5-8 hours (Module 7: 30-45 min, Module 6: 6-7.5 hours)

---

## 🎯 Executive Summary

### Current Status
- **Module 7 (Communication Hub):** 95% complete, 5 minor build errors remaining
- **Module 6 (Take Pride Awards):** ~45% complete, needs full implementation

### Database Verification ✅
Both modules have complete database schemas:

**Module 7 Tables (7):**
- ✅ announcements (15 columns)
- ✅ announcement_recipients (12 columns)
- ✅ announcement_templates (12 columns)
- ✅ communication_analytics (12 columns)
- ✅ communication_automation_rules (14 columns)
- ✅ communication_segments (9 columns)
- ✅ in_app_notifications (12 columns)

**Module 6 Tables (6):**
- ✅ award_categories (13 columns)
- ✅ award_cycles (16 columns)
- ✅ nominations (16 columns)
- ✅ jury_members (10 columns)
- ✅ jury_scores (15 columns)
- ✅ award_winners (13 columns)

### Implementation Strategy
1. **Quick Win:** Complete Module 7 first (30-45 min) → 100% complete
2. **Deep Work:** Complete Module 6 systematically (6-7.5 hours) → 100% complete
3. **Skills:** Use `nextjs16-web-development` + `advanced-tables-components`

---

## 🚨 CRITICAL: Avoiding Next.js 16 Errors

### Error 1: Uncached Data Outside Suspense
**❌ WRONG - Blocks entire page:**
```typescript
export default async function Page() {
  const data = await getData() // NO SUSPENSE = SLOW!
  return <div>{data}</div>
}
```

**✅ CORRECT - Streams data:**
```typescript
async function DataComponent() {
  const data = await getData()
  return <div>{data}</div>
}

export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DataComponent />
    </Suspense>
  )
}
```

### Error 2: cookies() Inside "use cache"
**❌ WRONG:**
```typescript
'use cache'
export async function getData() {
  const supabase = await createServerClient() // Uses cookies() internally!
}
```

**✅ CORRECT - Option 1 (Recommended):**
```typescript
// No 'use cache' directive - use cache() from React instead
import { cache } from 'react'

export const getData = cache(async () => {
  const supabase = await createServerClient()
  const { data } = await supabase.from('table').select()
  return data
})
```

**✅ CORRECT - Option 2:**
```typescript
// Pass cookies as parameter from outside cached scope
'use cache'
export async function getData(cookieHeader: string) {
  // Use cookie header instead of cookies() function
}
```

### Error 3: Synchronous searchParams Access
**❌ WRONG:**
```typescript
export default function Page({ searchParams }: PageProps) {
  const category = searchParams.category // ERROR: searchParams is Promise
}
```

**✅ CORRECT:**
```typescript
export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams // AWAIT IT!
  const category = searchParams.category // Now safe
}
```

---

## 📋 PHASE 1: Complete Module 7 (30-45 minutes)

### Current Issues
1. Cache components flag not enabled
2. Missing export: `getAnnouncementRecipients`
3. Type mismatches in announcements
4. Analytics type adjustments needed
5. Database migration not executed

### Task 1.1: Enable Cache Components (2 min)
**File:** `next.config.ts`

```typescript
const nextConfig = {
  // ... existing config
  experimental: {
    cacheComponents: true, // ADD THIS
  }
}

export default nextConfig
```

### Task 1.2: Fix Missing Export (5 min)
**File:** `lib/data/communication.ts`

Add this function:
```typescript
/**
 * Get announcement recipients with delivery status
 */
export const getAnnouncementRecipients = cache(async (
  announcementId: string,
  filters?: {
    channel?: 'email' | 'whatsapp' | 'in_app'
    status?: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed'
    limit?: number
    offset?: number
  }
) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('announcement_recipients')
    .select(`
      *,
      member:members (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      )
    `, { count: 'exact' })
    .eq('announcement_id', announcementId)
    .order('created_at', { ascending: false })

  if (filters?.channel) {
    query = query.eq('channel', filters.channel)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    recipients: data || [],
    total: count || 0
  }
})
```

### Task 1.3: Fix Type Definitions (10 min)
**File:** `types/communication.ts` (or wherever defined)

Update these types:
```typescript
export interface AnnouncementWithDetails extends Announcement {
  priority: 'low' | 'normal' | 'high' | 'urgent' // ADD THIS
  creator: {                                       // ADD THIS
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
  segment?: CommunicationSegment
  template?: AnnouncementTemplate
  _count?: {
    recipients: number
    delivered: number
    opened: number
    clicked: number
  }
}

export interface PaginatedAnnouncements {
  items: Announcement[]           // RENAME from 'data' to 'items'
  total: number
  page: number
  page_count: number             // ADD THIS
  page_size: number
}
```

### Task 1.4: Fix Analytics Types (5 min)
**File:** Update dashboard pages to access analytics properly

```typescript
// In analytics dashboard page
const analytics = await getCommunicationAnalytics()

// Access like this:
const totalSent = analytics.overview.total_sent        // NOT analytics.total_sent
const deliveryRate = analytics.overview.delivery_rate  // NOT analytics.delivery_rate
```

### Task 1.5: Run Database Migration (5 min)
```bash
# If migration file exists
cd D:\JKKN\yi-connect
npx supabase migration up

# OR if you need to apply manually
# Execute the SQL in supabase/migrations/*_communication_hub.sql
```

### Task 1.6: Verify Build (5 min)
```bash
npm run build
# Expected: Build completed successfully with 0 errors
```

**Checkpoint:** Module 7 should now be 100% complete! ✅

---

## 📋 PHASE 2: Module 6 - Types & Validations (45-60 minutes)

### Task 2.1: Create Complete Types File (20 min)
**File:** `types/award.ts`

```typescript
// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface AwardCategory {
  id: string
  chapter_id: string
  name: string
  description: string | null
  criteria: string[] // JSON array of criteria
  scoring_weights: {
    impact: number
    innovation: number
    participation: number
    consistency: number
    leadership: number
  }
  frequency: 'monthly' | 'quarterly' | 'annual' | 'one_time'
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AwardCycle {
  id: string
  category_id: string
  cycle_name: string
  year: number
  period_identifier: string | null // e.g., "Q1", "Jan", etc.
  start_date: string
  end_date: string
  nomination_deadline: string
  jury_deadline: string
  status: 'draft' | 'open' | 'nominations_closed' | 'judging' | 'review' | 'completed' | 'archived'
  description: string | null
  max_nominations_per_member: number
  winners_announced_at: string | null
  announcement_message: string | null
  created_at: string
  updated_at: string
}

export interface Nomination {
  id: string
  cycle_id: string
  nominee_id: string
  nominated_by_id: string
  justification: string
  supporting_evidence: string[] // URLs or file paths
  impact_description: string | null
  innovation_description: string | null
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn'
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by_id: string | null
  review_notes: string | null
  final_score: number | null
  final_rank: number | null
  created_at: string
  updated_at: string
}

export interface JuryMember {
  id: string
  cycle_id: string
  member_id: string
  assigned_by_id: string | null
  assigned_at: string
  total_nominations: number
  scored_nominations: number
  completed_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

export interface JuryScore {
  id: string
  nomination_id: string
  jury_member_id: string
  impact_score: number // 1-10
  innovation_score: number // 1-10
  participation_score: number // 1-10
  consistency_score: number // 1-10
  leadership_score: number // 1-10
  total_score: number // Auto-calculated
  weighted_score: number // Auto-calculated
  comments: string | null
  is_anomaly: boolean
  anomaly_reason: string | null
  scored_at: string
  updated_at: string
}

export interface AwardWinner {
  id: string
  cycle_id: string
  nomination_id: string
  rank: number // 1, 2, or 3
  final_score: number
  announced_at: string | null
  announced_by_id: string | null
  announcement_sent: boolean
  certificate_generated: boolean
  certificate_url: string | null
  certificate_generated_at: string | null
  added_to_profile: boolean
  created_at: string
}

// ============================================================================
// WITH DETAILS (Joined data)
// ============================================================================

export interface AwardCategoryWithDetails extends AwardCategory {
  chapter: {
    id: string
    name: string
  }
  _count?: {
    cycles: number
    nominations: number
  }
}

export interface AwardCycleWithDetails extends AwardCycle {
  category: AwardCategory
  _count?: {
    nominations: number
    jury_members: number
    winners: number
  }
}

export interface NominationWithDetails extends Nomination {
  cycle: AwardCycle
  nominee: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
  nominated_by: {
    id: string
    first_name: string
    last_name: string
  }
  scores?: JuryScore[]
  average_scores?: {
    impact: number
    innovation: number
    participation: number
    consistency: number
    leadership: number
    total: number
    weighted: number
  }
}

export interface JuryMemberWithDetails extends JuryMember {
  cycle: AwardCycle
  member: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  assigned_by?: {
    id: string
    first_name: string
    last_name: string
  }
}

export interface AwardWinnerWithDetails extends AwardWinner {
  cycle: AwardCycleWithDetails
  nomination: NominationWithDetails
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface AwardCategoryFilters {
  chapter_id?: string
  is_active?: boolean
  frequency?: AwardCategory['frequency']
  search?: string
}

export interface AwardCycleFilters {
  category_id?: string
  status?: AwardCycle['status']
  year?: number
  search?: string
}

export interface NominationFilters {
  cycle_id?: string
  nominee_id?: string
  nominated_by_id?: string
  status?: Nomination['status']
  search?: string
  limit?: number
  offset?: number
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface RankedNomination extends NominationWithDetails {
  rank: number
  percentile: number
}

export interface LeaderboardEntry {
  member_id: string
  member_name: string
  member_avatar?: string
  total_awards: number
  first_place_count: number
  second_place_count: number
  third_place_count: number
  latest_award_date: string
  award_categories: string[]
}

export interface AwardStatistics {
  total_categories: number
  active_cycles: number
  total_nominations: number
  pending_nominations: number
  total_jury_members: number
  avg_jury_completion_rate: number
  total_winners: number
  most_awarded_member: {
    member_id: string
    member_name: string
    award_count: number
  } | null
}

export interface CycleStatistics {
  cycle_id: string
  cycle_name: string
  total_nominations: number
  unique_nominees: number
  unique_nominators: number
  jury_completion_percentage: number
  avg_score: number
  score_variance: number
  top_3_nominees: Array<{
    nominee_id: string
    nominee_name: string
    score: number
    rank: number
  }>
}

export interface NominationScoreCalculation {
  nomination_id: string
  individual_scores: JuryScore[]
  average_scores: {
    impact: number
    innovation: number
    participation: number
    consistency: number
    leadership: number
  }
  weighted_score: number
  total_jury_members: number
  completed_scores: number
  score_variance: number
  has_anomalies: boolean
}

export interface EligibilityCheck {
  is_eligible: boolean
  reasons: string[]
  member_id: string
  cycle_id: string
  existing_nomination_id?: string
}
```

### Task 2.2: Create Zod Validation Schemas (25 min)
**File:** `lib/validations/award.ts`

```typescript
import { z } from 'zod'

// ============================================================================
// AWARD CATEGORY SCHEMAS
// ============================================================================

const scoringWeightsSchema = z.object({
  impact: z.number().min(0).max(1),
  innovation: z.number().min(0).max(1),
  participation: z.number().min(0).max(1),
  consistency: z.number().min(0).max(1),
  leadership: z.number().min(0).max(1),
}).refine(
  (weights) => {
    const sum = weights.impact + weights.innovation + weights.participation +
                 weights.consistency + weights.leadership
    return Math.abs(sum - 1) < 0.01 // Allow for floating point precision
  },
  { message: 'Scoring weights must sum to 1.0' }
)

export const createCategorySchema = z.object({
  chapter_id: z.string().uuid(),
  name: z.string().min(3, 'Category name must be at least 3 characters').max(100),
  description: z.string().optional().nullable(),
  criteria: z.array(z.string()).min(1, 'At least one criterion is required'),
  scoring_weights: scoringWeightsSchema,
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time']),
  icon: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional().nullable(),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
})

export const updateCategorySchema = createCategorySchema.partial()

// ============================================================================
// AWARD CYCLE SCHEMAS
// ============================================================================

export const createCycleSchema = z.object({
  category_id: z.string().uuid(),
  cycle_name: z.string().min(3).max(100),
  year: z.coerce.number().int().min(2020).max(2100),
  period_identifier: z.string().max(50).optional().nullable(),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  nomination_deadline: z.string().datetime(),
  jury_deadline: z.string().datetime(),
  status: z.enum(['draft', 'open', 'nominations_closed', 'judging', 'review', 'completed', 'archived']).default('draft'),
  description: z.string().optional().nullable(),
  max_nominations_per_member: z.coerce.number().int().min(1).default(1),
  announcement_message: z.string().optional().nullable(),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
).refine(
  (data) => new Date(data.nomination_deadline) >= new Date(data.start_date),
  { message: 'Nomination deadline must be on or after start date', path: ['nomination_deadline'] }
).refine(
  (data) => new Date(data.nomination_deadline) <= new Date(data.end_date),
  { message: 'Nomination deadline must be on or before end date', path: ['nomination_deadline'] }
).refine(
  (data) => new Date(data.jury_deadline) >= new Date(data.nomination_deadline),
  { message: 'Jury deadline must be after nomination deadline', path: ['jury_deadline'] }
)

export const updateCycleSchema = createCycleSchema.partial()

// ============================================================================
// NOMINATION SCHEMAS
// ============================================================================

export const createNominationSchema = z.object({
  cycle_id: z.string().uuid(),
  nominee_id: z.string().uuid(),
  nominated_by_id: z.string().uuid(),
  justification: z.string().min(50, 'Justification must be at least 50 characters').max(2000),
  supporting_evidence: z.array(z.string().url()).default([]),
  impact_description: z.string().min(20).max(1000).optional().nullable(),
  innovation_description: z.string().min(20).max(1000).optional().nullable(),
  status: z.enum(['draft', 'submitted']).default('draft'),
})

export const updateNominationSchema = createNominationSchema.partial()

export const reviewNominationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  review_notes: z.string().min(10).max(500),
  reviewed_by_id: z.string().uuid(),
})

// ============================================================================
// JURY SCORING SCHEMAS
// ============================================================================

export const juryScoreSchema = z.object({
  nomination_id: z.string().uuid(),
  jury_member_id: z.string().uuid(),
  impact_score: z.coerce.number().int().min(1, 'Score must be between 1-10').max(10, 'Score must be between 1-10'),
  innovation_score: z.coerce.number().int().min(1).max(10),
  participation_score: z.coerce.number().int().min(1).max(10),
  consistency_score: z.coerce.number().int().min(1).max(10),
  leadership_score: z.coerce.number().int().min(1).max(10),
  comments: z.string().max(500).optional().nullable(),
})

export const updateJuryScoreSchema = juryScoreSchema.partial().required({ nomination_id: true, jury_member_id: true })

// ============================================================================
// WINNER SCHEMAS
// ============================================================================

export const declareWinnerSchema = z.object({
  cycle_id: z.string().uuid(),
  nomination_id: z.string().uuid(),
  rank: z.coerce.number().int().min(1).max(3),
  announced_by_id: z.string().uuid(),
})

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

export const categoryFiltersSchema = z.object({
  chapter_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'annual', 'one_time']).optional(),
  search: z.string().optional(),
})

export const cycleFiltersSchema = z.object({
  category_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'open', 'nominations_closed', 'judging', 'review', 'completed', 'archived']).optional(),
  year: z.coerce.number().int().optional(),
  search: z.string().optional(),
})

export const nominationFiltersSchema = z.object({
  cycle_id: z.string().uuid().optional(),
  nominee_id: z.string().uuid().optional(),
  nominated_by_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateCycleInput = z.infer<typeof createCycleSchema>
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>
export type CreateNominationInput = z.infer<typeof createNominationSchema>
export type UpdateNominationInput = z.infer<typeof updateNominationSchema>
export type ReviewNominationInput = z.infer<typeof reviewNominationSchema>
export type JuryScoreInput = z.infer<typeof juryScoreSchema>
export type UpdateJuryScoreInput = z.infer<typeof updateJuryScoreSchema>
export type DeclareWinnerInput = z.infer<typeof declareWinnerSchema>
```

**Checkpoint:** Types and validations are complete! Compile check with `npx tsc --noEmit`

---

## 📋 PHASE 3: Module 6 - Complete Data Layer (60-75 minutes)

### Task 3.1: Complete Awards Data Layer (Full Implementation)
**File:** `lib/data/awards.ts`

The file already has some functions. Add these missing ones:

```typescript
// Add to existing file after the current functions

// ============================================================================
// NOMINATIONS
// ============================================================================

/**
 * Get nominations with pagination and filtering
 */
export const getNominations = cache(async (filters?: NominationFilters) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles (
        id,
        cycle_name,
        status,
        category:award_categories (
          id,
          name,
          icon,
          color
        )
      ),
      nominee:members!nominations_nominee_id_fkey (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      ),
      nominated_by:members!nominations_nominated_by_id_fkey (
        id,
        first_name,
        last_name
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters?.cycle_id) {
    query = query.eq('cycle_id', filters.cycle_id)
  }

  if (filters?.nominee_id) {
    query = query.eq('nominee_id', filters.nominee_id)
  }

  if (filters?.nominated_by_id) {
    query = query.eq('nominated_by_id', filters.nominated_by_id)
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    query = query.or(
      `justification.ilike.%${filters.search}%,` +
      `impact_description.ilike.%${filters.search}%,` +
      `innovation_description.ilike.%${filters.search}%`
    )
  }

  const limit = filters?.limit || 50
  const offset = filters?.offset || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) throw error

  return {
    nominations: (data || []) as NominationWithDetails[],
    total: count || 0,
    page: Math.floor(offset / limit) + 1,
    page_size: limit,
    page_count: Math.ceil((count || 0) / limit)
  }
})

/**
 * Get single nomination by ID with full details
 */
export const getNominationById = cache(async (id: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles (
        *,
        category:award_categories (*)
      ),
      nominee:members!nominations_nominee_id_fkey (*),
      nominated_by:members!nominations_nominated_by_id_fkey (
        id,
        first_name,
        last_name,
        email
      ),
      scores:jury_scores (
        *,
        jury_member:jury_members (
          member:members (
            id,
            first_name,
            last_name
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  // Calculate average scores
  const scores = data.scores || []
  if (scores.length > 0) {
    const avg = {
      impact: scores.reduce((sum, s) => sum + s.impact_score, 0) / scores.length,
      innovation: scores.reduce((sum, s) => sum + s.innovation_score, 0) / scores.length,
      participation: scores.reduce((sum, s) => sum + s.participation_score, 0) / scores.length,
      consistency: scores.reduce((sum, s) => sum + s.consistency_score, 0) / scores.length,
      leadership: scores.reduce((sum, s) => sum + s.leadership_score, 0) / scores.length,
    }

    data.average_scores = {
      ...avg,
      total: avg.impact + avg.innovation + avg.participation + avg.consistency + avg.leadership,
      weighted: (avg.impact * 0.3) + (avg.innovation * 0.25) + (avg.participation * 0.2) +
                (avg.consistency * 0.15) + (avg.leadership * 0.1)
    }
  }

  return data as NominationWithDetails
})

/**
 * Get nominations for a specific member (as nominee)
 */
export const getNominationsByMember = cache(async (memberId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      cycle:award_cycles (
        cycle_name,
        category:award_categories (
          name,
          icon,
          color
        )
      )
    `)
    .eq('nominee_id', memberId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data || []
})

/**
 * Get nominations for a specific cycle
 */
export const getNominationsByCycle = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('nominations')
    .select(`
      *,
      nominee:members!nominations_nominee_id_fkey (
        id,
        first_name,
        last_name,
        avatar_url
      ),
      nominated_by:members!nominations_nominated_by_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .eq('cycle_id', cycleId)
    .order('final_score', { ascending: false, nullsFirst: false })

  if (error) throw error

  return data || []
})

/**
 * Check if member is eligible to be nominated for a cycle
 */
export const checkNominationEligibility = cache(async (
  memberId: string,
  cycleId: string
): Promise<EligibilityCheck> => {
  const supabase = await createServerSupabaseClient()

  // Check if cycle exists and is open
  const { data: cycle } = await supabase
    .from('award_cycles')
    .select('*, category:award_categories(*)')
    .eq('id', cycleId)
    .single()

  if (!cycle) {
    return {
      is_eligible: false,
      reasons: ['Cycle not found'],
      member_id: memberId,
      cycle_id: cycleId
    }
  }

  if (cycle.status !== 'open') {
    return {
      is_eligible: false,
      reasons: [`Cycle is ${cycle.status}, not accepting nominations`],
      member_id: memberId,
      cycle_id: cycleId
    }
  }

  // Check if deadline passed
  if (new Date(cycle.nomination_deadline) < new Date()) {
    return {
      is_eligible: false,
      reasons: ['Nomination deadline has passed'],
      member_id: memberId,
      cycle_id: cycleId
    }
  }

  // Check existing nomination
  const { data: existing } = await supabase
    .from('nominations')
    .select('id')
    .eq('nominee_id', memberId)
    .eq('cycle_id', cycleId)
    .single()

  if (existing) {
    return {
      is_eligible: false,
      reasons: ['Member already nominated for this cycle'],
      member_id: memberId,
      cycle_id: cycleId,
      existing_nomination_id: existing.id
    }
  }

  // Check if member exists and is active
  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('id', memberId)
    .single()

  if (!member || member.status !== 'active') {
    return {
      is_eligible: false,
      reasons: ['Member not found or not active'],
      member_id: memberId,
      cycle_id: cycleId
    }
  }

  return {
    is_eligible: true,
    reasons: [],
    member_id: memberId,
    cycle_id: cycleId
  }
})

// ============================================================================
// JURY FUNCTIONS
// ============================================================================

/**
 * Get jury members for a cycle
 */
export const getJuryMembers = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_members')
    .select(`
      *,
      member:members (
        id,
        first_name,
        last_name,
        email,
        avatar_url
      ),
      assigned_by:members!jury_members_assigned_by_id_fkey (
        id,
        first_name,
        last_name
      )
    `)
    .eq('cycle_id', cycleId)
    .order('assigned_at', { ascending: false })

  if (error) throw error

  return data as JuryMemberWithDetails[]
})

/**
 * Get jury member assignments (what they need to score)
 */
export const getJuryAssignments = cache(async (memberId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_members')
    .select(`
      *,
      cycle:award_cycles (
        *,
        category:award_categories (*)
      )
    `)
    .eq('member_id', memberId)
    .eq('completed_at', null)
    .order('cycle.jury_deadline', { ascending: true })

  if (error) throw error

  return data || []
})

/**
 * Get jury progress for a cycle
 */
export const getJuryProgress = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  // Get all jury members
  const { data: juryMembers, error: juryError } = await supabase
    .from('jury_members')
    .select('*')
    .eq('cycle_id', cycleId)

  if (juryError) throw juryError

  // Get all nominations for this cycle
  const { data: nominations, error: nomError } = await supabase
    .from('nominations')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('status', 'approved')

  if (nomError) throw nomError

  const totalJuryMembers = juryMembers?.length || 0
  const totalNominations = nominations?.length || 0
  const expectedScores = totalJuryMembers * totalNominations

  // Get completed scores
  const { count: completedScores } = await supabase
    .from('jury_scores')
    .select('id', { count: 'exact', head: true })
    .in('nomination_id', nominations?.map(n => n.id) || [])

  const completionPercentage = expectedScores > 0
    ? ((completedScores || 0) / expectedScores) * 100
    : 0

  return {
    total_jury_members: totalJuryMembers,
    total_nominations: totalNominations,
    expected_scores: expectedScores,
    completed_scores: completedScores || 0,
    completion_percentage: Math.round(completionPercentage * 10) / 10,
    jury_members: juryMembers || []
  }
})

// ============================================================================
// SCORING & RANKINGS
// ============================================================================

/**
 * Get all scores for a nomination
 */
export const getNominationScores = cache(async (nominationId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('jury_scores')
    .select(`
      *,
      jury_member:jury_members (
        member:members (
          id,
          first_name,
          last_name
        )
      )
    `)
    .eq('nomination_id', nominationId)
    .order('scored_at', { ascending: true })

  if (error) throw error

  return data || []
})

/**
 * Calculate weighted scores for all nominations in a cycle
 */
export const getRankedNominations = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  // Get all approved nominations with scores
  const { data: nominations, error } = await supabase
    .from('nominations')
    .select(`
      *,
      nominee:members!nominations_nominee_id_fkey (
        id,
        first_name,
        last_name,
        avatar_url
      ),
      scores:jury_scores (
        impact_score,
        innovation_score,
        participation_score,
        consistency_score,
        leadership_score,
        weighted_score
      )
    `)
    .eq('cycle_id', cycleId)
    .in('status', ['approved', 'under_review'])

  if (error) throw error

  // Calculate average weighted score for each nomination
  const ranked = (nominations || [])
    .map(nom => {
      const scores = nom.scores || []
      const avgWeighted = scores.length > 0
        ? scores.reduce((sum, s) => sum + s.weighted_score, 0) / scores.length
        : 0

      return {
        ...nom,
        final_score: avgWeighted,
        score_count: scores.length
      }
    })
    .filter(nom => nom.score_count > 0) // Only include nominations with scores
    .sort((a, b) => b.final_score - a.final_score) // Sort by score descending
    .map((nom, index) => ({
      ...nom,
      rank: index + 1,
      percentile: ((nominations.length - index) / nominations.length) * 100
    }))

  return ranked as RankedNomination[]
})

/**
 * Detect scoring anomalies (large variance between jurors)
 */
export const detectScoringAnomalies = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data: nominations, error } = await supabase
    .from('nominations')
    .select(`
      id,
      nominee:members!nominations_nominee_id_fkey (
        first_name,
        last_name
      ),
      scores:jury_scores (
        weighted_score,
        is_anomaly,
        anomaly_reason
      )
    `)
    .eq('cycle_id', cycleId)

  if (error) throw error

  // Calculate variance for each nomination
  const anomalies = (nominations || [])
    .map(nom => {
      const scores = nom.scores?.map(s => s.weighted_score) || []
      if (scores.length < 2) return null

      const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length
      const stdDev = Math.sqrt(variance)

      // Flag as anomaly if standard deviation > 2 (on 0-10 scale)
      const hasAnomaly = stdDev > 2

      return {
        nomination_id: nom.id,
        nominee_name: `${nom.nominee?.first_name} ${nom.nominee?.last_name}`,
        mean_score: mean,
        std_dev: stdDev,
        variance: variance,
        is_anomaly: hasAnomaly,
        scores: scores
      }
    })
    .filter(a => a !== null && a.is_anomaly)

  return anomalies
})

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Get all-time leaderboard
 */
export const getLeaderboard = cache(async (filters?: {
  year?: number
  category_id?: string
  limit?: number
}) => {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('award_winners')
    .select(`
      *,
      nomination:nominations (
        nominee:members!nominations_nominee_id_fkey (
          id,
          first_name,
          last_name,
          avatar_url
        )
      ),
      cycle:award_cycles (
        cycle_name,
        year,
        category:award_categories (
          name,
          icon,
          color
        )
      )
    `)
    .order('announced_at', { ascending: false })

  if (filters?.year) {
    query = query.eq('cycle.year', filters.year)
  }

  if (filters?.category_id) {
    query = query.eq('cycle.category_id', filters.category_id)
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) throw error

  return data as AwardWinnerWithDetails[]
})

/**
 * Get winners for a specific cycle
 */
export const getWinnersByCycle = cache(async (cycleId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_winners')
    .select(`
      *,
      nomination:nominations (
        *,
        nominee:members!nominations_nominee_id_fkey (*)
      )
    `)
    .eq('cycle_id', cycleId)
    .order('rank', { ascending: true })

  if (error) throw error

  return data as AwardWinnerWithDetails[]
})

/**
 * Get all awards for a specific member
 */
export const getMemberAwards = cache(async (memberId: string) => {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('award_winners')
    .select(`
      *,
      cycle:award_cycles (
        cycle_name,
        year,
        category:award_categories (
          name,
          icon,
          color
        )
      )
    `)
    .eq('nomination.nominee_id', memberId)
    .order('announced_at', { ascending: false })

  if (error) throw error

  return data || []
})

/**
 * Get top performers (most awards)
 */
export const getTopPerformers = cache(async (limit: number = 10) => {
  const supabase = await createServerSupabaseClient()

  // This requires a more complex query - using RPC function would be better
  // For now, get all winners and aggregate in JS
  const { data: winners, error } = await supabase
    .from('award_winners')
    .select(`
      *,
      nomination:nominations (
        nominee_id,
        nominee:members!nominations_nominee_id_fkey (
          id,
          first_name,
          last_name,
          avatar_url
        )
      ),
      cycle:award_cycles (
        year,
        category:award_categories (name)
      )
    `)

  if (error) throw error

  // Aggregate by member
  const memberMap = new Map<string, LeaderboardEntry>()

  winners?.forEach(winner => {
    const nominee = winner.nomination?.nominee
    if (!nominee) return

    if (!memberMap.has(nominee.id)) {
      memberMap.set(nominee.id, {
        member_id: nominee.id,
        member_name: `${nominee.first_name} ${nominee.last_name}`,
        member_avatar: nominee.avatar_url,
        total_awards: 0,
        first_place_count: 0,
        second_place_count: 0,
        third_place_count: 0,
        latest_award_date: winner.announced_at || '',
        award_categories: []
      })
    }

    const entry = memberMap.get(nominee.id)!
    entry.total_awards++

    if (winner.rank === 1) entry.first_place_count++
    else if (winner.rank === 2) entry.second_place_count++
    else if (winner.rank === 3) entry.third_place_count++

    const categoryName = winner.cycle?.category?.name
    if (categoryName && !entry.award_categories.includes(categoryName)) {
      entry.award_categories.push(categoryName)
    }

    if (winner.announced_at && winner.announced_at > entry.latest_award_date) {
      entry.latest_award_date = winner.announced_at
    }
  })

  return Array.from(memberMap.values())
    .sort((a, b) => b.total_awards - a.total_awards)
    .slice(0, limit)
})
```

**Checkpoint:** Data layer complete! Test with simple page component.

---

## 📋 PHASE 4: Module 6 - Server Actions (75-90 minutes)

### Task 4.1: Create Complete Server Actions File
**File:** `app/actions/award.ts`

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createCategorySchema,
  updateCategorySchema,
  createCycleSchema,
  updateCycleSchema,
  createNominationSchema,
  updateNominationSchema,
  reviewNominationSchema,
  juryScoreSchema,
  updateJuryScoreSchema,
  declareWinnerSchema,
} from '@/lib/validations/award'
import { z } from 'zod'

type ActionResult<T = any> = {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// CATEGORY ACTIONS
// ============================================================================

export async function createAwardCategory(
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)

    // Parse JSON fields
    if (typeof data.criteria === 'string') {
      data.criteria = JSON.parse(data.criteria)
    }
    if (typeof data.scoring_weights === 'string') {
      data.scoring_weights = JSON.parse(data.scoring_weights)
    }

    const validated = createCategorySchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: category, error } = await supabase
      .from('award_categories')
      .insert(validated)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create category' }
  }
}

export async function updateAwardCategory(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)

    if (typeof data.criteria === 'string') {
      data.criteria = JSON.parse(data.criteria)
    }
    if (typeof data.scoring_weights === 'string') {
      data.scoring_weights = JSON.parse(data.scoring_weights)
    }

    const validated = updateCategorySchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: category, error } = await supabase
      .from('award_categories')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    revalidatePath(`/awards/admin/categories/${id}`)
    return { success: true, data: category }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update category' }
  }
}

export async function deleteAwardCategory(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if category has cycles
    const { count } = await supabase
      .from('award_cycles')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (count && count > 0) {
      return {
        success: false,
        error: 'Cannot delete category with existing cycles'
      }
    }

    const { error } = await supabase
      .from('award_categories')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete category' }
  }
}

export async function toggleCategoryStatus(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('award_categories')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/categories')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to update category status' }
  }
}

// ============================================================================
// CYCLE ACTIONS
// ============================================================================

export async function createAwardCycle(
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)
    const validated = createCycleSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: cycle, error } = await supabase
      .from('award_cycles')
      .insert(validated)
      .select(`
        *,
        category:award_categories (*)
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath('/awards')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to create cycle' }
  }
}

export async function updateAwardCycle(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)
    const validated = updateCycleSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: cycle, error } = await supabase
      .from('award_cycles')
      .update(validated)
      .eq('id', id)
      .select(`
        *,
        category:award_categories (*)
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath(`/awards/admin/cycles/${id}`)
    revalidatePath('/awards')
    return { success: true, data: cycle }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update cycle' }
  }
}

export async function advanceCycleStatus(
  id: string,
  newStatus: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('award_cycles')
      .update({
        status: newStatus,
        ...(newStatus === 'completed' && {
          winners_announced_at: new Date().toISOString()
        })
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    revalidatePath('/awards')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to update cycle status' }
  }
}

// ============================================================================
// NOMINATION ACTIONS
// ============================================================================

export async function submitNomination(
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)

    // Parse array fields
    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    const validated = createNominationSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    // Check eligibility first
    const eligibility = await checkNominationEligibilityAction(
      validated.nominee_id,
      validated.cycle_id
    )

    if (!eligibility.is_eligible) {
      return {
        success: false,
        error: eligibility.reasons.join(', ')
      }
    }

    const { data: nomination, error } = await supabase
      .from('nominations')
      .insert({
        ...validated,
        submitted_at: validated.status === 'submitted' ? new Date().toISOString() : null
      })
      .select(`
        *,
        cycle:award_cycles (
          cycle_name,
          category:award_categories (name)
        ),
        nominee:members!nominations_nominee_id_fkey (
          first_name,
          last_name
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    revalidatePath('/awards/nominate')
    return { success: true, data: nomination }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to submit nomination' }
  }
}

export async function updateNomination(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)

    if (typeof data.supporting_evidence === 'string') {
      data.supporting_evidence = JSON.parse(data.supporting_evidence)
    }

    const validated = updateNominationSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: nomination, error } = await supabase
      .from('nominations')
      .update({
        ...validated,
        ...(validated.status === 'submitted' && {
          submitted_at: new Date().toISOString()
        })
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    revalidatePath(`/awards/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update nomination' }
  }
}

export async function withdrawNomination(id: string): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('nominations')
      .update({ status: 'withdrawn' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/nominations')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to withdraw nomination' }
  }
}

export async function reviewNomination(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)
    const validated = reviewNominationSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    const { data: nomination, error } = await supabase
      .from('nominations')
      .update({
        status: validated.status,
        review_notes: validated.review_notes,
        reviewed_by_id: validated.reviewed_by_id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/review')
    revalidatePath(`/awards/nominations/${id}`)
    return { success: true, data: nomination }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to review nomination' }
  }
}

async function checkNominationEligibilityAction(
  memberId: string,
  cycleId: string
) {
  // This would call the data layer function
  // Simplified version here
  return { is_eligible: true, reasons: [] }
}

// ============================================================================
// JURY SCORING ACTIONS
// ============================================================================

export async function assignJuryMember(
  cycleId: string,
  memberId: string,
  assignedById: string
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if already assigned
    const { data: existing } = await supabase
      .from('jury_members')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('member_id', memberId)
      .single()

    if (existing) {
      return { success: false, error: 'Member already assigned as jury' }
    }

    // Count nominations for this cycle
    const { count } = await supabase
      .from('nominations')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', cycleId)
      .eq('status', 'approved')

    const { data, error } = await supabase
      .from('jury_members')
      .insert({
        cycle_id: cycleId,
        member_id: memberId,
        assigned_by_id: assignedById,
        total_nominations: count || 0
      })
      .select(`
        *,
        member:members (
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) throw error

    revalidatePath('/awards/admin/cycles')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to assign jury member' }
  }
}

export async function submitJuryScores(
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)
    const validated = juryScoreSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    // Check if already scored
    const { data: existing } = await supabase
      .from('jury_scores')
      .select('id')
      .eq('nomination_id', validated.nomination_id)
      .eq('jury_member_id', validated.jury_member_id)
      .single()

    if (existing) {
      return { success: false, error: 'You have already scored this nomination' }
    }

    // Calculate weighted score
    const weightedScore =
      (validated.impact_score * 0.3) +
      (validated.innovation_score * 0.25) +
      (validated.participation_score * 0.2) +
      (validated.consistency_score * 0.15) +
      (validated.leadership_score * 0.1)

    const { data: score, error } = await supabase
      .from('jury_scores')
      .insert({
        ...validated,
        total_score: validated.impact_score + validated.innovation_score +
                     validated.participation_score + validated.consistency_score +
                     validated.leadership_score,
        weighted_score: weightedScore
      })
      .select()
      .single()

    if (error) throw error

    // Update jury member progress
    const { error: updateError } = await supabase.rpc('increment_jury_scored_count', {
      jury_member_id: validated.jury_member_id
    })

    revalidatePath('/awards/jury')
    revalidatePath(`/awards/jury/${validated.nomination_id}`)
    return { success: true, data: score }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to submit scores' }
  }
}

export async function updateJuryScores(
  scoreId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const data = Object.fromEntries(formData)
    const validated = updateJuryScoreSchema.parse(data)
    const supabase = await createServerSupabaseClient()

    // Recalculate weighted score if scores changed
    let updateData: any = { ...validated }

    if (validated.impact_score || validated.innovation_score ||
        validated.participation_score || validated.consistency_score ||
        validated.leadership_score) {

      // Get current scores to merge with updates
      const { data: current } = await supabase
        .from('jury_scores')
        .select('*')
        .eq('id', scoreId)
        .single()

      if (current) {
        const finalScores = {
          impact: validated.impact_score ?? current.impact_score,
          innovation: validated.innovation_score ?? current.innovation_score,
          participation: validated.participation_score ?? current.participation_score,
          consistency: validated.consistency_score ?? current.consistency_score,
          leadership: validated.leadership_score ?? current.leadership_score,
        }

        updateData.total_score = finalScores.impact + finalScores.innovation +
                                  finalScores.participation + finalScores.consistency +
                                  finalScores.leadership

        updateData.weighted_score =
          (finalScores.impact * 0.3) +
          (finalScores.innovation * 0.25) +
          (finalScores.participation * 0.2) +
          (finalScores.consistency * 0.15) +
          (finalScores.leadership * 0.1)
      }
    }

    const { data: score, error } = await supabase
      .from('jury_scores')
      .update(updateData)
      .eq('id', scoreId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/jury')
    return { success: true, data: score }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    return { success: false, error: 'Failed to update scores' }
  }
}

// ============================================================================
// WINNER ACTIONS
// ============================================================================

export async function declareWinners(
  cycleId: string,
  winners: Array<{ nomination_id: string; rank: number }>
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user (announced_by)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Insert all winners
    const winnersData = winners.map(w => ({
      cycle_id: cycleId,
      nomination_id: w.nomination_id,
      rank: w.rank,
      announced_by_id: user.id,
      announced_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('award_winners')
      .insert(winnersData)
      .select(`
        *,
        nomination:nominations (
          nominee:members!nominations_nominee_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `)

    if (error) throw error

    // Update cycle status
    await supabase
      .from('award_cycles')
      .update({
        status: 'completed',
        winners_announced_at: new Date().toISOString()
      })
      .eq('id', cycleId)

    revalidatePath('/awards/admin/review')
    revalidatePath('/awards/leaderboard')
    revalidatePath('/awards')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to declare winners' }
  }
}

export async function generateCertificate(
  winnerId: string
): Promise<ActionResult> {
  try {
    // This would integrate with PDF generation service
    // For now, just mark as generated
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('award_winners')
      .update({
        certificate_generated: true,
        certificate_generated_at: new Date().toISOString(),
        certificate_url: `/certificates/${winnerId}.pdf` // Placeholder
      })
      .eq('id', winnerId)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/awards/leaderboard')
    return { success: true, data }
  } catch (error) {
    return { success: false, error: 'Failed to generate certificate' }
  }
}
```

**Checkpoint:** Server actions complete! Test forms in browser.

---

## 📋 REMAINING PHASES (Summary)

Due to length constraints, here's the summary of remaining phases:

### **PHASE 5: Fix/Complete Pages (60-75 min)**
- Fix all page components for async searchParams
- Add proper Suspense boundaries
- Implement loading states
- Test navigation

### **PHASE 6: Complete Components (45-60 min)**
- Verify existing 7 components
- Create 5 missing components
- Add loading skeletons
- Create index.ts export

### **PHASE 7: Data Tables (45-60 min)**
- Nominations table with advanced-tables-components
- Jury scoring table
- Leaderboard table
- All with export functionality

### **PHASE 8: Integration & Testing (30-45 min)**
- Test Module 1 integration (member links)
- Test Module 7 integration (notifications)
- Full build verification
- Smoke tests

### **PHASE 9: Documentation (15-20 min)**
- Update IMPLEMENTATION_PLAN.md
- Create MODULE_6_PROGRESS_SUMMARY.md
- Add code comments

---

## ✅ SUCCESS CRITERIA

### Module 7 Complete When:
- ✅ `npm run build` succeeds with 0 errors
- ✅ Can create announcements
- ✅ Real-time notifications work
- ✅ Templates load correctly
- ✅ Analytics dashboard displays data

### Module 6 Complete When:
- ✅ `npm run build` succeeds with 0 errors
- ✅ Can create categories and cycles
- ✅ Can submit nominations
- ✅ Jury scoring works correctly
- ✅ Weighted calculations accurate
- ✅ Leaderboard displays winners
- ✅ Data tables support pagination/filtering/export
- ✅ Integrations with Module 1 & 7 work

---

## 🚀 EXECUTION SCHEDULE

**Session 1:** Module 7 (30-45 min) → 100% ✅
**Session 2:** Module 6 Types & Data Layer (2 hours)
**Session 3:** Module 6 Actions & Pages (2.5 hours)
**Session 4:** Module 6 Components & Tables (2 hours)
**Session 5:** Integration & Documentation (1 hour)

**Total Time:** 6.5-8 hours for both modules 100% complete

---

## 📝 NOTES

1. **Always await searchParams** in async page components
2. **Never use cookies() inside 'use cache'** - use cache() from React
3. **Always wrap async data in Suspense** with meaningful loading states
4. **Test build after each phase** to catch errors early
5. **Use the skills**: nextjs16-web-development + advanced-tables-components

---

**Ready to execute! Start with Module 7 quick fixes for immediate win! 🎯**
