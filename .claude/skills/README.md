# MyJKKN Claude Skills

This directory contains specialized Claude skills for common development tasks in the MyJKKN project.

## Available Skills

### 1. Toast Migrator (`toast-migrator.md`)
**Purpose**: Migrate from custom `useToast` hook to direct `react-hot-toast` usage

**When to use**:
- File shows toast-related errors
- Mixing of `toast({` and `toast.error()` patterns
- Need to update legacy toast code

**How to activate**:
```
"Use the toast-migrator skill to update [FILE_PATH]"
```

**Auto-triggers when**:
- Claude detects `useToast` import
- Claude sees `toast({ title:` pattern
- User mentions "toast error" or "fix toast"

**Example**:
```
User: "app/(routes)/academic/attendance/page.tsx shows toast errors"
Claude: [Automatically loads toast-migrator skill and fixes]
```

## How to Use Skills

### Method 1: Explicit Invocation
Tell Claude to use a specific skill:
```
"Use the toast-migrator skill to migrate app/(routes)/billing/invoices/page.tsx"
```

### Method 2: Auto-Detection
Claude automatically uses appropriate skills when it detects patterns:
```
User: "This file has toast errors" → Claude detects and uses toast-migrator
User: "Update database schema" → Claude uses supabase conventions
```

### Method 3: Load at Session Start
Add to your session starter:
```
Load all skills from .claude/skills/ and auto-apply when needed:
- toast-migrator: For toast hook migrations
- [future skills]
```

## Creating New Skills

### Skill Template Structure
```markdown
# Skill Name

## Purpose
Brief description of what this skill does

## When to Use This Skill
List of scenarios where this skill applies

## Detection Patterns
Patterns that should auto-trigger this skill

## Process
Step-by-step instructions

## Edge Cases
Common gotchas and how to handle

## Verification
How to confirm successful completion

## Troubleshooting
Common issues and solutions
```

### Adding a New Skill

1. Create new `.md` file in `.claude/skills/`
2. Follow the template structure above
3. Add entry to this README
4. Test with real scenarios
5. Update session starter if needed

## Skill Best Practices

### ✅ DO
- Make skills focused and specific
- Include clear detection patterns
- Provide concrete examples
- Add verification steps
- Document edge cases
- Include rollback strategies

### ❌ DON'T
- Create overlapping skills
- Make skills too generic
- Skip verification steps
- Ignore edge cases
- Forget error handling

## Future Skills (Planned)

### Error Handler
Standardize error handling patterns across MyJKKN:
- Consistent try-catch blocks
- Proper error logging
- User-friendly error messages
- Error boundaries

### Type Generator
Generate TypeScript types from database schema:
- Read Supabase schema
- Generate interface definitions
- Create DTOs and filters
- Update type files

### Component Creator
Create new components following MyJKKN patterns:
- Standard component structure
- Proper imports and exports
- TypeScript interfaces
- Styling with Tailwind
- Dark mode support

### API Route Generator
Generate API routes with standard patterns:
- Request validation
- Error handling
- Response formatting
- Permission checks
- Database queries

### Test Generator
Generate tests for components and functions:
- Unit tests for utilities
- Component tests with React Testing Library
- Integration tests for API routes
- Mock data generators

## Integration with Other Tools

### With Slash Commands
Skills can be triggered by slash commands:
```json
// .claude/commands/fix-toast.md
Use the toast-migrator skill on the current file
```

### With Task Agents
Skills provide instructions for Task agents:
```
"Use Task tool with general-purpose agent:
Follow toast-migrator skill to update all files in app/(routes)/academic/"
```

### With Session Starter
Auto-load skills at session start:
```markdown
# .claude/START_SESSION.md
Load all skills from .claude/skills/ and remember:
- Auto-apply toast-migrator when detecting useToast
- Auto-apply [other skills] when detecting [patterns]
```

## Skill Versioning

Each skill includes:
- Version number (semver)
- Last updated date
- Tested on (project version)

Update version when:
- Major changes to process (breaking)
- Adding new features (minor)
- Bug fixes or clarifications (patch)

## Contributing Skills

To contribute a new skill:

1. Identify a repetitive pattern in MyJKKN development
2. Document the current manual process
3. Create skill following template
4. Test on real scenarios
5. Document edge cases found
6. Update this README

## Skill Metrics

Track skill effectiveness:
- Number of times used
- Time saved vs manual
- Error rate before/after
- Developer feedback

## Support

If a skill isn't working:
1. Check the skill file for correct patterns
2. Verify Claude loaded the skill
3. Review the detection patterns
4. Update the skill if needed
5. Report issues in project documentation

---

**Last Updated**: 2025-01-24
**Total Skills**: 1
**Next Review**: Add 2-3 more skills based on common patterns
