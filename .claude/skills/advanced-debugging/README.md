# Advanced Debugging Skill for MyJKKN

## Quick Start

This skill provides specialized debugging workflows and tools for the MyJKKN application stack.

### Tech Stack Covered
- ✅ Next.js 15 (App Router) + TypeScript
- ✅ Supabase (Database, Auth, RLS)
- ✅ React Query 5.72+
- ✅ Service Layer Pattern
- ✅ Enhanced Logger System
- ✅ Middleware-based Auth

## Usage

### 1. Run Debug Analyzer

```bash
node .claude/skills/advanced-debugging/scripts/debug-analyzer.js
```

This checks your project configuration and identifies potential issues.

### 2. When You Hit a Bug

1. **Reproduce the issue** - Create consistent steps
2. **Check logs** - Use Enhanced Logger output in console
3. **Identify the layer** - UI, Service, or Database?
4. **Follow the workflow** - See `references/debugging-workflows.md`
5. **Apply the fix** - Check `references/common-issues.md` for known solutions

### 3. Common Scenarios

**Authentication Issues:**
```bash
# Check middleware logs
# Review references/common-issues.md → Authentication section
```

**Database Query Issues:**
```bash
node scripts/db-query-tester.js --test-connection
node scripts/db-query-tester.js --test-rls your_table
```

**Performance Problems:**
```bash
# Review references/performance-debugging.md
# Check React Query DevTools
# Profile with React DevTools Profiler
```

## File Structure

```
advanced-debugging/
├── SKILL.md                       # Main skill documentation
├── README.md                      # This file
├── references/
│   ├── debugging-workflows.md     # Step-by-step processes
│   ├── common-issues.md           # Known issues + solutions
│   ├── supabase-debugging.md      # Supabase-specific debugging
│   └── performance-debugging.md   # Performance optimization
└── scripts/
    ├── debug-analyzer.js          # Analyze project config
    ├── log-analyzer.js            # Analyze logs
    └── db-query-tester.js         # Test database queries
```

## Key Features

### 1. Systematic Workflows
Step-by-step processes for debugging each layer of your application.

### 2. Common Issues Database
Known issues with tested solutions specific to your stack.

### 3. Automated Tools
Scripts that analyze your configuration and identify problems.

### 4. Quick Reference
Fast lookup for common debugging commands and patterns.

## Quick Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Test production build
npm run clean            # Clear cache

# Type Checking
npx tsc --noEmit         # Check TypeScript errors

# Debugging Scripts
node scripts/debug-analyzer.js       # Analyze project
node scripts/log-analyzer.js         # Analyze logs
node scripts/db-query-tester.js      # Test database
```

## Enhanced Logger

Your application uses the Enhanced Logger for smart log capture:

```typescript
import { logger } from '@/lib/utils/enhanced-logger';

logger.dev('module', 'Development log', data);    // Dev only
logger.warn('module', 'Warning message', data);    // Production
logger.error('module', 'Error message', error);    // Production
```

View captured logs:
```javascript
import { getLogManager } from '@/lib/utils/enhanced-logger';
const manager = getLogManager();
console.log(manager.getSummary());
console.log(manager.getLogsByModule());
```

## Common Issues Quick Reference

### Middleware Redirect Loop
→ Check `references/common-issues.md` → Authentication

### Query Returns No Data
→ Check `references/supabase-debugging.md` → RLS Policies

### Slow Page Load
→ Check `references/performance-debugging.md` → Optimization

### TypeScript Errors
→ Check `references/common-issues.md` → TypeScript

### React Query Stale Data
→ Check `references/common-issues.md` → React Query

## When to Use What

**UI not rendering correctly?**
→ `debugging-workflows.md` → Frontend/UI Debugging

**Service method failing?**
→ `debugging-workflows.md` → Service Layer Debugging

**Query returns empty?**
→ `supabase-debugging.md` → RLS Policy Debugging

**Performance slow?**
→ `performance-debugging.md` → Optimization Guide

**Known issue?**
→ `common-issues.md` → Search for your issue

## Tips for Success

1. **Always reproduce first** - If you can't reproduce it consistently, you can't fix it
2. **Check logs early** - Enhanced Logger captures everything
3. **Test one thing at a time** - Change one variable, test, repeat
4. **Document your findings** - Add to common-issues.md if recurring
5. **Use the tools** - Run debug-analyzer before diving deep

## Getting Help

1. Review the debugging workflows
2. Check common issues database
3. Run automated analysis tools
4. Check React Query DevTools
5. Review Supabase dashboard logs
6. Check middleware execution logs

## Contributing

When you solve a new issue:

1. Add it to `references/common-issues.md`
2. Include reproduction steps
3. Document the solution
4. Add prevention tips

## Version

**Version**: 1.0.0
**Created**: 2025-01-16
**For**: MyJKKN Project
**Tech Stack**: Next.js 15, Supabase, React Query, TypeScript

---

**Pro Tip**: Bookmark this README and the references folder for quick access during debugging sessions!
