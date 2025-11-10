# Toast Migrator Skill

## Purpose
Systematically migrate MyJKKN codebase from custom `useToast` hook to direct `react-hot-toast` library usage. This skill ensures consistent toast API usage across the application and prevents the mixing of different toast patterns.

## When to Use This Skill

Use this skill when:
1. User reports toast-related errors in a file
2. User mentions "useToast hook error" or "toast not working"
3. You detect `useToast` import in a file during code analysis
4. User asks to "update toast" or "fix toast" in a component
5. You see mixed usage of `toast({` and `toast.error/success`

## Detection Patterns

Auto-trigger this skill when you find:
- `import { useToast } from '@/hooks/use-toast'`
- `import { useToast } from '@/components/ui/use-toast'`
- `const { toast } = useToast()`
- `toast({ title: '...', description: '...', variant: '...' })`

## Migration Process

### Step 1: Analyze Current Usage
```bash
# Find all files using useToast
grep -r "useToast" --include="*.tsx" --include="*.ts" app/ components/ lib/

# Find object-based toast calls
grep -r "toast({" --include="*.tsx" --include="*.ts" app/ components/

# Count instances
grep -c "toast({" [FILE_PATH]
```

### Step 2: Verify Import
Check if file has correct import:
```typescript
// ❌ REMOVE THIS
import { useToast } from '@/hooks/use-toast';
import { useToast } from '@/components/ui/use-toast';

// ✅ USE THIS
import toast from 'react-hot-toast';
```

### Step 3: Migration Patterns

Apply these transformations systematically:

#### Pattern 1: Error Toasts
```typescript
// ❌ BEFORE
toast({
  title: 'Error',
  description: 'Something went wrong',
  variant: 'destructive'
})

// ✅ AFTER
toast.error('Something went wrong')
```

#### Pattern 2: Success Toasts
```typescript
// ❌ BEFORE
toast({
  title: 'Success',
  description: 'Operation completed successfully'
})

// ✅ AFTER
toast.success('Operation completed successfully')
```

#### Pattern 3: Info/Warning Toasts
```typescript
// ❌ BEFORE
toast({
  title: 'Warning',
  description: 'Please check your inputs'
})

// ✅ AFTER
toast('Please check your inputs', { duration: 3000 })
```

#### Pattern 4: Loading Toasts
```typescript
// ❌ BEFORE
const toastId = toast({
  title: 'Loading',
  description: 'Processing...'
})

// ✅ AFTER
const toastId = toast.loading('Processing...')
```

#### Pattern 5: Long Duration Errors
```typescript
// ❌ BEFORE
toast({
  title: 'Error',
  description: 'Long error message',
  variant: 'destructive',
  duration: 5000
})

// ✅ AFTER
toast.error('Long error message', { duration: 5000 })
```

#### Pattern 6: Dismissible Toasts
```typescript
// ❌ BEFORE
const id = toast({ title: 'Info', description: 'Message' })
// later...
toast.dismiss(id)

// ✅ AFTER
const id = toast('Message')
// later...
toast.dismiss(id)
```

### Step 4: Remove Hook Usage
```typescript
// ❌ REMOVE THIS
const { toast } = useToast();

// ✅ No declaration needed - import does everything
import toast from 'react-hot-toast';
```

### Step 5: Verification
After migration, verify:
```bash
# Should return 0
grep -c "useToast" [FILE_PATH]

# Should return 0
grep -c "toast({" [FILE_PATH]

# Should have valid imports
grep -c "import toast from 'react-hot-toast'" [FILE_PATH]

# Should have method calls
grep -c "toast\." [FILE_PATH]
```

## File-by-File Workflow

For each file:

1. **Read the file** to understand toast usage patterns
2. **Count instances** of toast({ to track progress
3. **Update import** - Replace useToast with react-hot-toast
4. **Remove hook declaration** - Delete `const { toast } = useToast()`
5. **Replace toast calls** - Use patterns above, working from top to bottom
6. **Handle file modifications** - If file changes during edits, re-read and continue
7. **Verify completion** - Ensure 0 useToast and 0 toast({ remaining
8. **Test imports** - Run type check if possible

## Common Edge Cases

### Multiple Toast Calls in One Statement
```typescript
// ❌ BEFORE
if (error) {
  toast({ title: 'Error', description: 'Failed', variant: 'destructive' });
  return;
}
toast({ title: 'Success', description: 'Done' });

// ✅ AFTER
if (error) {
  toast.error('Failed');
  return;
}
toast.success('Done');
```

### Conditional Toast Variants
```typescript
// ❌ BEFORE
toast({
  title: isError ? 'Error' : 'Success',
  description: message,
  variant: isError ? 'destructive' : 'default'
})

// ✅ AFTER
if (isError) {
  toast.error(message);
} else {
  toast.success(message);
}
```

### Toast with Custom Duration
```typescript
// ❌ BEFORE
toast({
  title: 'Notice',
  description: 'Check attendance settings',
  duration: 6000
})

// ✅ AFTER
toast('Check attendance settings', { duration: 6000 })
```

## Best Practices

### Duration Guidelines
- **Error toasts**: 5000ms (longer for user to read)
- **Success toasts**: 3000ms (default)
- **Info toasts**: 3000-4000ms
- **Loading toasts**: Dismiss manually with `toast.dismiss(id)`

### Message Guidelines
- Keep messages concise (< 60 characters ideal)
- Use action-oriented language ("Failed to save" not "Error")
- Avoid redundant "Error:" or "Success:" prefixes
- Include context when helpful ("Failed to save attendance for 2024-01-15")

### Error Handling Patterns
```typescript
// ✅ GOOD - Consistent error handling
try {
  await someOperation();
  toast.success('Operation completed');
} catch (error) {
  console.error('[MODULE] Operation failed:', error);
  toast.error(
    error instanceof Error ? error.message : 'Operation failed'
  );
}
```

## Multi-File Migration

When migrating multiple files:

1. **Prioritize** by usage frequency:
   - API routes (highest impact)
   - Form components
   - Service layers
   - Utility functions

2. **Track progress**:
   ```bash
   # List all files needing migration
   grep -l "useToast" --include="*.tsx" app/ components/ > toast-migration-list.txt

   # Count remaining
   cat toast-migration-list.txt | wc -l
   ```

3. **Update systematically**:
   - One file at a time
   - Verify each before moving to next
   - Document any issues

## Rollback Strategy

If migration causes issues:

1. Check the original pattern:
   ```typescript
   // If something breaks, temporarily use this format
   import toast from 'react-hot-toast';

   toast.custom((t) => (
     <div className={`${t.visible ? 'animate-enter' : 'animate-leave'}`}>
       Custom toast content
     </div>
   ));
   ```

2. Verify react-hot-toast is installed:
   ```bash
   npm list react-hot-toast
   ```

3. Check for Toaster component in layout:
   ```typescript
   // Should exist in root layout
   import { Toaster } from 'react-hot-toast';

   <Toaster position="top-right" />
   ```

## Automation Commands

### Quick Migration
```bash
# Find file
FILE="app/(routes)/path/to/component.tsx"

# Check current state
grep -n "useToast\|toast({" "$FILE"

# After manual migration, verify
grep -c "useToast" "$FILE" && grep -c "toast({" "$FILE"
```

### Batch Check
```bash
# Check all files in a directory
find app/(routes)/academic -name "*.tsx" -exec sh -c '
  file="$1"
  count=$(grep -c "toast({" "$file" 2>/dev/null || echo 0)
  if [ "$count" -gt 0 ]; then
    echo "$file: $count instances"
  fi
' sh {} \;
```

## Success Criteria

Migration is complete when:
- ✅ 0 files with `useToast` import
- ✅ 0 files with `toast({` calls
- ✅ All toast calls use `toast.error()`, `toast.success()`, `toast()`, or `toast.loading()`
- ✅ Proper import: `import toast from 'react-hot-toast'`
- ✅ No TypeScript errors
- ✅ All toasts display correctly in UI

## Reference Examples

### Before Migration (app/example/page.tsx)
```typescript
import { useToast } from '@/hooks/use-toast';

export default function ExamplePage() {
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      await api.submit();
      toast({
        title: 'Success',
        description: 'Form submitted successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit form',
        variant: 'destructive'
      });
    }
  };
}
```

### After Migration (app/example/page.tsx)
```typescript
import toast from 'react-hot-toast';

export default function ExamplePage() {
  const handleSubmit = async () => {
    try {
      await api.submit();
      toast.success('Form submitted successfully');
    } catch (error) {
      toast.error('Failed to submit form');
    }
  };
}
```

## Troubleshooting

### Issue: "toast is not a function"
**Solution**: Check import statement
```typescript
// ❌ Wrong
import { toast } from 'react-hot-toast';

// ✅ Correct
import toast from 'react-hot-toast';
```

### Issue: "File modified since read"
**Solution**: Re-read file and try again
```typescript
// The file was changed by linter/formatter
// Read the file again to get current state
// Then apply the Edit
```

### Issue: "String to replace not found"
**Solution**:
1. Read the specific section with offset
2. Verify exact string with whitespace
3. Use smaller, more specific string replacements

## Memory Aids

Remember for this project:
- MyJKKN uses react-hot-toast directly (no wrapper)
- All toast calls should use method-based API
- Duration defaults: errors=5000ms, success/info=3000ms
- Always import as default: `import toast from 'react-hot-toast'`
- Toaster component is already in root layout
- Log errors with console.error before showing toast

## Related Skills

- **error-handler**: For consistent error handling patterns
- **type-checker**: For verifying TypeScript after migration
- **import-organizer**: For cleaning up imports

## Skill Version
Version: 1.0.0
Last Updated: 2025-01-24
Tested On: MyJKKN v1.0 (Next.js 15, TypeScript)
