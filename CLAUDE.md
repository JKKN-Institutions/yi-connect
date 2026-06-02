# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 CANONICAL IDENTITY & ROLES — yi_directory IS THE MOTHER SOURCE

**Rule (effective 2026-05-28):** Every Yi person and every role they hold MUST be tracked in `yi_directory.people` and `yi_directory.role_assignments`. Per-vertical authorization tables (`yip.organizers`, `yi.national_admins`, `future.chapter_core_team`, future `yuva.*`, future `thalir.*`) are CACHES or VIEWS over `yi_directory`, not independent sources of truth.

**Why:** Pre-2026-05-28, each vertical (YIP, Yi-Future, Yuva, Thalir, Masoom, …) reinvented its own auth table. Result: the same person had to be added in N places, super-admin gates differed across modules, and no single query could answer "who is a national admin of vertical X?". yi_directory was created in Phase 15 to fix this but the sync was only partially wired — chapter chairs synced, vertical chairs did not.

**Shape (canonical):**
- `yi_directory.people` — one row per human (`id`, `user_id` → `auth.users.id`, `full_name`, `email`, `phone`, `photo_url`, `is_active`).
- `yi_directory.role_assignments` — one row per (person, app, role, year, optional chapter/zone). Key columns: `person_id`, `app` ('yip' | 'future' | 'yuva' | 'thalir' | 'masoom' | …), `role` ('national' | 'rm' | 'chapter_em' | 'chapter_chair' | 'national_admin' | …), `yi_year`, `yi_chapter`, `yi_zone`, `yi_edition_id`, `title`, `is_active`, `is_primary`.

**How to apply when building/modifying any feature that involves people or roles:**
1. **Read path:** Auth gates (e.g. `requireSuperAdmin()`, `isChapterAdmin()`, `isNationalChair()`) MUST query `yi_directory.role_assignments` joined to `yi_directory.people.user_id`. Do NOT query `yip.organizers`, `yi.national_admins`, or `future.chapter_core_team` directly for authorization decisions.
2. **Write path:** Onboarding (invites, promotions, role grants) MUST INSERT into `yi_directory` first. Per-vertical tables sync FROM yi_directory via triggers or scheduled sync, never the reverse.
3. **New vertical (e.g. Yuva, Masoom):** Do NOT create a `yuva.organizers` or `masoom.admins` table. Read from `yi_directory.role_assignments WHERE app='yuva'`. If a derived/cached view is genuinely needed for performance, create it as a materialized view, not as a parallel source.
4. **Migrations that touch role data:** Always show SQL first (per project rule). Migration name must include `yi_directory_sync_` or `yi_directory_seed_` so the pattern is greppable.
5. **Cleanup debt (open):** `yi.national_admins` and `yip.organizers` exist today and still gate live code. They will be deprecated by moving `requireSuperAdmin()` and friends to query yi_directory. Do not add new rows to those legacy tables — add to yi_directory and let the sync handle it.

**If unsure whether a new table belongs:** It probably doesn't. Reuse `yi_directory.role_assignments` with a new `app` value or `role` value. The table is intentionally generic for this reason.

## 🔴 REPO & DEPLOY REALITY — this repo IS the live monorepo

**`yi-connect` (GitHub `JKKN-Institutions/yi-connect`) is the single source of truth.** It hosts FOUR apps in one Next.js project: Yi Connect main (`app/(dashboard)/*`, `app/events/*`), **YIP** (`app/yip/*`), **Yi-Future** (`app/yi-future/*`), and **YiFi**.

- **Deploy:** production is `https://yi-connect-app.vercel.app` (YIP at `/yip`). Yi is a **separate org from JKKN** — there is NO apex domain, and JKKN skills/branding/terminology do NOT apply. The Vercel alias **auto-flips on push to `master`** (no manual `vercel alias set` for routine pushes — verify by SHA, not by `x-vercel-cache`).
- **Supabase:** project ref `bkmpbcoxbjyafieabxao`. DDL / read-only queries via the Management API `POST https://api.supabase.com/v1/projects/bkmpbcoxbjyafieabxao/database/query` (token at `~/.supabase/access-token`).

### ⛔ The retired standalone YIP repo — DO NOT EDIT IT
`/Users/omm/PROJECTS/YIP` (GitHub `Ommsharravana/yip-platform`, now archived) is the **original standalone YIP app from before the 2026-05-26 absorption** — a **stale duplicate**. Editing code there **ships NOTHING.** ALL YIP code work happens **here** in `app/yip/*`. That folder survives only as a historical archive (auto-save to it is disabled). **If your shell CWD is `/Users/omm/PROJECTS/YIP` you are in the dead repo — `cd /Users/omm/PROJECTS/yi-connect` before any code work.**

## 🔴 PER-VERTICAL AUTHORIZATION RULES → `.claude/rules/<vertical>-authorization.md`

App-specific authz models are **path-scoped rules** that auto-load only when you touch that vertical's code, keeping them out of this always-loaded file:
- **YIP** (`app/yip/**`, `lib/yip/**`) → `.claude/rules/yip-authorization.md` — two gates: event-scoped `getYipEventAccess` vs master-data `requireSuperAdmin`.
- **Yi-Future** (`app/yi-future/**`, `lib/yi-future/**`) → `.claude/rules/yi-future-authorization.md` — strict (write) vs broad (view) `app='future'` tiers.
- **YiFi** (`app/yifi/**`, `lib/yifi/**`) → `.claude/rules/yifi-authorization.md` — edition-scoped organiser permissions + access-code members.

**Building a NEW vertical** (yuva, thalir, masoom, …)? Create `.claude/rules/<vertical>-authorization.md` with `paths: ["app/<vertical>/**", "lib/<vertical>/**"]` and document that app's gates there. Do NOT add app-specific authz to this root file, and do NOT pre-create empty rules for verticals that don't exist yet. The **universal** discipline that applies to every vertical — yi_directory as the role source; fail CLOSED; deny EXPLICITLY with a surfaced reason (never a silent redirect); never gate a WRITE with a VIEW predicate — stays in this root file.

## 🔴 OPERATIONAL GOTCHAS (hard-won — re-reading these prevents re-learning them)

- **`npx tsc --noEmit` on the MAIN tree is the ONLY authoritative build gate.** Worktree / parallel-agent tsc LIES (no `node_modules` → false "cannot find module" errors). Re-run tsc on `/Users/omm/PROJECTS/yi-connect` after merging any branch or agent work.
- **`Agent` with `isolation:'worktree'` builds the worktree from the SHELL CWD's repo, NOT a path named in the prompt.** `cd /Users/omm/PROJECTS/yi-connect` BEFORE spawning, or agents land in the wrong repo. (`cd` does not persist across Bash tool calls — chain it in one command.)
- **A `"use server"` file may export ONLY async functions.** Non-async exports (types, constants, objects) break the Vercel build → put them in `lib/`.
- **The Supabase Management API BYPASSES RLS** → false-green on write tests. To exercise a real write path, use a service-client REST insert with header `Content-Profile: yip` (the path deployed code takes), not the Management API.
- **`supabase gen types` appends a "new version available" banner** that corrupts `types.ts` — strip it (`sed '/^A new version/,$d'`) before writing. IDE diagnostics lag ~30 min after regen; tsc is authoritative.
- **Audits flag ONE line per drift pattern** — when an audit flags a bad column/table, grep the WHOLE codebase for it before declaring done (e.g. `jury_members` appeared in 9 places; the audit flagged 1).
- **A "small change" diff with hundreds of deletions = a `Write`-clobber.** Use `Edit`/`MultiEdit` on existing files; reserve `Write` for brand-new files. Expected diff for adding a gate is ~+3/−0; if you see −300, STOP and revert.

## Project Overview

yi-connect is a Next.js 16 application using React 19, TypeScript, and Tailwind CSS 4. The project integrates shadcn/ui components (New York style) with extensive Radix UI primitives for building a modern, accessible user interface.

**Application Purpose:**
Yi Connect is a comprehensive Yi Chapter Management System designed to unify member operations, events, finance, communication, and leadership across Yi Chapters. The system consists of 11 core functional modules that will be developed step-by-step following standardized patterns.

**Complete Application Requirements:**
All detailed module specifications, features, and requirements are documented in the `docs/` directory. Refer to:
- `docs/yi_chapter_prd_summary.md` - Overall system architecture and module overview
- `docs/Module-01-Member-Intelligence-Hub.md` through `docs/Module-11-Mobile-Command-Center.md` - Individual module specifications
- `docs/System-Integration-and-Impact-Analysis.md` - Cross-module integration patterns

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Development Workflow & Required Skills

### Module-by-Module Development Approach

**IMPORTANT:** Yi Connect MUST be developed in a systematic, module-by-module fashion. Each module should be fully implemented, tested, and validated before moving to the next module. This ensures:
- Consistent code quality across all modules
- Proper integration between modules
- Standardized patterns throughout the application
- Easier debugging and maintenance

### Required Skills Usage

Claude Code MUST use the following standardized skills for all development work in this project:

#### 1. nextjs16-web-development Skill (MANDATORY for ALL module development)

**When to use:**
- Creating ANY new module or feature in the application
- Implementing CRUD operations
- Building forms with Server Actions
- Setting up data fetching with caching strategies
- Creating API routes or server actions
- Any database schema design or modifications

**How to invoke:**
```
Use the nextjs16-web-development skill
```

**What it provides:**
- Standardized Next.js 16 patterns with Cache Components and Server Actions
- Optimal caching strategies using `use cache` directive
- Proper Supabase integration with RLS policies
- Type-safe forms with Zod validation
- Standardized project structure and file organization
- Complete CRUD workflow patterns

**You MUST follow the patterns from this skill including:**
- Using Server Actions for all mutations (not Route Handlers)
- Applying `use cache` with appropriate `cacheLife` for data fetching
- Using `updateTag()` for instant cache invalidation
- Implementing Suspense boundaries for streaming UI
- Following the standard module structure (types → data layer → actions → components → pages)

#### 2. advanced-tables-components Skill (MANDATORY for ALL data tables)

**When to use:**
- Building ANY data table or list view in the application
- Implementing tables with pagination, sorting, or filtering
- Creating admin dashboards with tabular data
- Building report views or analytics tables
- Any component that displays data in rows and columns

**How to invoke:**
```
Use the advanced-tables-components skill
```

**What it provides:**
- Production-ready table patterns with TanStack Table v8
- Server-side pagination, sorting, and filtering for large datasets
- Advanced filtering UI (faceted filters, date ranges, sliders)
- Bulk actions and row selection
- Export functionality (CSV, XLSX, JSON)
- Real-time table updates with Supabase subscriptions
- Column management (visibility, resizing, reordering)

**You MUST follow the patterns from this skill including:**
- Using server-side operations for datasets > 1000 rows
- Implementing URL-based state management for filters/sorting
- Adding proper loading states and skeletons
- Including accessibility features (ARIA labels, keyboard navigation)
- Using the standardized data-table component structure

### Development Process for Each Module

When implementing a new module, follow this exact workflow:

1. **Planning Phase:**
   - Review the module specification in `docs/`
   - Identify all required features and data models
   - Determine which components need tables (use advanced-tables-components)
   - Plan the database schema and RLS policies

2. **Implementation Phase (using nextjs16-web-development):**
   - Create database schema with Supabase migration
   - Define TypeScript types and Zod validation schemas
   - Implement cached data fetching functions in `lib/data/`
   - Create Server Actions in `app/actions/`
   - Build UI components (forms, cards, etc.)
   - Create pages with proper Suspense boundaries

3. **Table Implementation Phase (using advanced-tables-components when needed):**
   - Identify all list/table views in the module
   - Implement server-side data fetching with filters/sorting
   - Create column definitions with appropriate filter types
   - Build the data table component with toolbar and pagination
   - Add bulk actions and export functionality if required

4. **Integration Phase:**
   - Test integration with other modules
   - Verify cache invalidation works correctly
   - Ensure proper error handling and loading states
   - Validate accessibility and responsive design

5. **Documentation Phase:**
   - Update module documentation in `docs/` if needed
   - Document any API endpoints or Server Actions
   - Add comments for complex business logic

### Skill Invocation Examples

Example 1 - Starting a new module:
```
I need to implement the Member Intelligence Hub module. Use the nextjs16-web-development skill to help me build this module following standardized patterns.
```

Example 2 - Building a data table:
```
I need to create a members list table with filtering and sorting. Use the advanced-tables-components skill to implement this.
```

Example 3 - Building both:
```
Use the nextjs16-web-development skill to set up the Events module, and then use the advanced-tables-components skill to create the events listing table.
```

### CRITICAL RULES

1. **ALWAYS use nextjs16-web-development for module development** - Do not create modules without following the standardized patterns from this skill
2. **ALWAYS use advanced-tables-components for table components** - Do not build custom table solutions; use the proven patterns
3. **One module at a time** - Complete each module fully before moving to the next
4. **Follow the skill patterns strictly** - The skills contain battle-tested patterns; do not deviate
5. **Reference docs/ directory** - Always check module specifications before implementation
6. **Maintain consistency** - All modules must follow the same architectural patterns

## Architecture

### Framework & Routing
- **Next.js 16** with App Router (`app/` directory)
- React Server Components (RSC) enabled by default
- File-based routing in `app/` directory
- `app/layout.tsx` provides root layout with Geist Sans and Geist Mono fonts

### Styling System
- **Tailwind CSS 4** (latest version with new config format)
- Uses CSS variables for theming in `app/globals.css`
- Custom `@theme inline` directive for Tailwind 4
- `tw-animate-css` plugin for animations
- Color system based on oklch color space
- Design tokens: `--radius`, color variables, and sidebar/chart color schemes
- Dark mode: Custom variant `@custom-variant dark (&:is(.dark *))`

### UI Component System (shadcn/ui)
- Configuration in `components.json`:
  - Style: "new-york"
  - Icon library: lucide-react
  - RSC and TypeScript enabled
- All UI components located in `components/ui/`
- 50+ pre-built components from Radix UI primitives including:
  - Forms: Input, Textarea, Select, Checkbox, Radio, Switch
  - Overlays: Dialog, Sheet, Drawer, Popover, Hover Card
  - Navigation: Tabs, Menubar, Navigation Menu, Sidebar, Breadcrumb
  - Data Display: Table, Card, Avatar, Badge, Calendar, Chart
  - Feedback: Alert, Progress, Spinner, Skeleton, Toast (via react-hot-toast)
  - Layout: Accordion, Collapsible, Resizable, Scroll Area, Carousel

### State Management & Forms
- **react-hook-form** for form handling
- **zod** (v4) for schema validation
- **@hookform/resolvers** for integrating Zod with react-hook-form
- Form components use the Field/Item pattern from shadcn

### Path Aliases
TypeScript paths configured with `@/*` mapping to root:
- `@/components` → components/
- `@/lib` → lib/
- `@/hooks` → hooks/
- `@/ui` → components/ui/

### Utilities
- `lib/utils.ts`: Contains `cn()` helper (clsx + tailwind-merge) for conditional class merging
- `hooks/use-mobile.ts`: Custom hook for responsive mobile detection

## Key Technical Details

### TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- JSX: react-jsx (uses new JSX transform)
- Module resolution: bundler

### Styling Conventions
- Use the `cn()` utility from `@/lib/utils` for combining Tailwind classes
- Components use CSS variables defined in `globals.css` for theming
- Color tokens follow shadcn's design system (primary, secondary, accent, muted, destructive)
- Sidebar and chart components have dedicated color schemes

### Component Development
- Prefer using existing shadcn/ui components from `components/ui/` before creating new ones
- Components are server components by default; add `"use client"` directive when needed
- Form components should use react-hook-form with Zod validation
- Use Radix UI primitives for complex interactive components

### Adding shadcn/ui Components
Components are managed via the shadcn CLI. To add new components, use the standard shadcn commands (this project uses the "new-york" style preset).

## Module Implementation Roadmap

The Yi Connect application consists of 11 core modules that should be implemented in the following phased approach:

### Phase 1: Foundation Modules (Q1)
Priority: HIGH - Core functionality for basic operations

1. **Module 1 - Member Intelligence Hub**
   - Centralized member database with professional skills and availability
   - Smart volunteer matching and leadership readiness tracking
   - Skill-gap analytics and engagement metrics

2. **Module 3 - Event Lifecycle Manager**
   - Event creation, RSVPs, and venue booking automation
   - Volunteer assignments and post-event reporting
   - Integration with Member Hub for volunteer matching

3. **Module 4 - Financial Command Center**
   - Budgeting, expense tracking, and sponsorship pipelines
   - Reimbursement workflows and approval management
   - Predictive budget analytics

### Phase 2: Collaboration & Recognition (Q2)
Priority: MEDIUM - Enhanced member experience and external partnerships

4. **Module 2 - Stakeholder Relationship CRM**
   - Track schools, colleges, industries, government, NGOs, vendors
   - Contact histories, health scores, and MoU tracking

5. **Module 7 - Communication Hub**
   - Centralized announcements, newsletters, WhatsApp integration
   - Smart scheduling, audience targeting, and analytics

6. **Module 6 - Take Pride Award Automation**
   - Nomination and jury scoring system
   - Weighted scoring, leaderboards, and certificate generation

7. **Module 8 - Knowledge Management System**
   - Digital repository for reports, MoUs, templates, best practices
   - Full-text search, wiki pages, and national sync

### Phase 3: Leadership & Integration (Q3)
Priority: MEDIUM - Advanced management and scalability

8. **Module 5 - Succession & Leadership Pipeline**
   - Digital leadership selection with nomination tracking
   - Evaluation scoring and automated timeline management

9. **Module 9 - Vertical Performance Tracker**
   - Real-time dashboards for vertical heads to track KPIs
   - Auto-integration with event and finance data

10. **Module 10 - National Integration Layer**
    - API-based data exchange between chapters and national systems
    - Benchmarking, leadership sync, and unified communications

### Phase 4: Mobile & Analytics (Q4)
Priority: LOW - Mobile access and continuous improvement

11. **Module 11 - Mobile Command Center**
    - Mobile-first dashboard for members and leaders
    - Real-time access to events, engagement scores, and analytics

### Module Development Status

Track module completion status here:

- [x] Module 1 - Member Intelligence Hub
- [x] Module 2 - Stakeholder Relationship CRM
- [x] Module 3 - Event Lifecycle Manager
- [x] Module 4 - Financial Command Center
- [x] Module 5 - Succession & Leadership Pipeline
- [x] Module 6 - Take Pride Award Automation
- [x] Module 7 - Communication Hub
- [x] Module 8 - Knowledge Management System
- [x] Module 9 - Vertical Performance Tracker
- [x] Module 10 - National Integration Layer
- [x] Module 11 - Mobile Command Center (PWA with Serwist, offline support, push notifications)

**Note:** Always complete one module fully before moving to the next. Each module should include:
- Database schema and migrations
- Type definitions and validations
- Data fetching layer with caching
- Server Actions for mutations
- UI components and pages
- Data tables (where applicable)
- Integration with existing modules
- Testing and validation

## Project Dependencies

### Core Framework
- next: 16.0.1
- react: 19.2.0
- react-dom: 19.2.0

### UI & Styling
- All @radix-ui/react-* components (v1-2)
- tailwindcss: v4
- lucide-react: Icons
- class-variance-authority: Component variants
- vaul: Drawer component

### Data & Visualization
- recharts: Chart library (integrated with shadcn chart components)
- date-fns: Date utilities
- react-day-picker: Calendar component

### Forms & Validation
- react-hook-form: Form state management
- zod: v4 (note: newer version than typical)
- @hookform/resolvers: Form validation integration
