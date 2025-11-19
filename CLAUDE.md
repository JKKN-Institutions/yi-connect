# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- [ ] Module 4 - Financial Command Center (60% - Core Complete)
- [ ] Module 5 - Succession & Leadership Pipeline (35% - In Progress)
- [x] Module 6 - Take Pride Award Automation
- [x] Module 7 - Communication Hub
- [x] Module 8 - Knowledge Management System
- [x] Module 9 - Vertical Performance Tracker (92% - Backend Complete, Core UI Complete)
- [ ] Module 10 - National Integration Layer
- [ ] Module 11 - Mobile Command Center

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
