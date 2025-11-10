# Module Creation Template

Complete step-by-step guide for creating a new module in MyJKKN.

## Example: Library Management Module

This template shows how to create a complete module from scratch, following all MyJKKN conventions.

## Step 1: Check SQL_FILE_INDEX.md

**Always do this first!**

```bash
# Read the index
cat supabase/SQL_FILE_INDEX.md

# Grep for existing tables
grep -i "library\|book\|member\|borrow" supabase/SQL_FILE_INDEX.md
```

## Step 2: Design Module Tables

**Tables needed for Library Management:**
- `library_books` - Store book information
- `library_members` - Store member information
- `library_borrowing` - Track borrowing transactions
- `library_categories` - Book categories

## Step 3: Update 01_tables.sql

**Location:** `supabase/setup/01_tables.sql`

Add a new section at the end:

```sql
-- =====================================================
-- SECTION 15: LIBRARY MANAGEMENT TABLES
-- =====================================================
-- Library management system for tracking books, members, and borrowing
-- Created: 2025-01-27
-- Last Updated: 2025-01-27

-- =====================================================
-- TABLE: library_categories
-- =====================================================
-- Purpose: Categorization of library books

CREATE TABLE IF NOT EXISTS public.library_categories (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Business columns
    name TEXT NOT NULL,
    description TEXT,
    code TEXT,
    parent_id UUID REFERENCES public.library_categories(id),

    -- Audit columns
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_category_per_institution UNIQUE (institution_id, name)
);

COMMENT ON TABLE public.library_categories IS 'Book categories for library organization';

-- Enable RLS
ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_library_categories_institution_id
ON public.library_categories(institution_id);

CREATE INDEX idx_library_categories_parent_id
ON public.library_categories(parent_id);

-- Add trigger
CREATE TRIGGER update_library_categories_updated_at
BEFORE UPDATE ON public.library_categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: library_books
-- =====================================================
-- Purpose: Store book information in library

CREATE TABLE IF NOT EXISTS public.library_books (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Business columns
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    publisher TEXT,
    published_year INTEGER,
    edition TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    category_id UUID REFERENCES public.library_categories(id),
    location TEXT,
    description TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'retired')),

    -- Audit columns
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (available_copies <= total_copies),
    CHECK (available_copies >= 0)
);

COMMENT ON TABLE public.library_books IS 'Book inventory for library management';

-- Enable RLS
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_library_books_institution_id
ON public.library_books(institution_id);

CREATE INDEX idx_library_books_category_id
ON public.library_books(category_id);

CREATE INDEX idx_library_books_status
ON public.library_books(status);

CREATE INDEX idx_library_books_isbn
ON public.library_books(isbn);

CREATE INDEX idx_library_books_title
ON public.library_books USING gin(to_tsvector('english', title));

CREATE INDEX idx_library_books_author
ON public.library_books USING gin(to_tsvector('english', author));

-- Add trigger
CREATE TRIGGER update_library_books_updated_at
BEFORE UPDATE ON public.library_books
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: library_members
-- =====================================================
-- Purpose: Track library members (students and staff)

CREATE TABLE IF NOT EXISTS public.library_members (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Member references (either student or staff)
    student_id UUID REFERENCES public.students(id),
    staff_id UUID REFERENCES public.staff(id),

    -- Business columns
    member_type TEXT NOT NULL CHECK (member_type IN ('student', 'staff')),
    membership_number TEXT NOT NULL,
    membership_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    max_books INTEGER NOT NULL DEFAULT 3,
    max_days INTEGER NOT NULL DEFAULT 14,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),

    -- Audit columns
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (
        (member_type = 'student' AND student_id IS NOT NULL AND staff_id IS NULL) OR
        (member_type = 'staff' AND staff_id IS NOT NULL AND student_id IS NULL)
    ),
    CONSTRAINT unique_membership_number UNIQUE (institution_id, membership_number)
);

COMMENT ON TABLE public.library_members IS 'Library membership for students and staff';

-- Enable RLS
ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_library_members_institution_id
ON public.library_members(institution_id);

CREATE INDEX idx_library_members_student_id
ON public.library_members(student_id);

CREATE INDEX idx_library_members_staff_id
ON public.library_members(staff_id);

CREATE INDEX idx_library_members_status
ON public.library_members(status);

-- Add trigger
CREATE TRIGGER update_library_members_updated_at
BEFORE UPDATE ON public.library_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE: library_borrowing
-- =====================================================
-- Purpose: Track book borrowing transactions

CREATE TABLE IF NOT EXISTS public.library_borrowing (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenant
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,

    -- Foreign keys
    member_id UUID NOT NULL REFERENCES public.library_members(id),
    book_id UUID NOT NULL REFERENCES public.library_books(id),

    -- Business columns
    borrowed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    returned_date DATE,
    status TEXT DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
    fine_amount DECIMAL(10, 2) DEFAULT 0,
    fine_paid BOOLEAN DEFAULT FALSE,
    remarks TEXT,

    -- Audit columns
    borrowed_by UUID REFERENCES public.profiles(id),
    returned_to UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.library_borrowing IS 'Book borrowing transactions and history';

-- Enable RLS
ALTER TABLE public.library_borrowing ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_library_borrowing_institution_id
ON public.library_borrowing(institution_id);

CREATE INDEX idx_library_borrowing_member_id
ON public.library_borrowing(member_id);

CREATE INDEX idx_library_borrowing_book_id
ON public.library_borrowing(book_id);

CREATE INDEX idx_library_borrowing_status
ON public.library_borrowing(status);

CREATE INDEX idx_library_borrowing_due_date
ON public.library_borrowing(due_date);

CREATE INDEX idx_library_borrowing_borrowed_date
ON public.library_borrowing(borrowed_date DESC);

-- Add trigger
CREATE TRIGGER update_library_borrowing_updated_at
BEFORE UPDATE ON public.library_borrowing
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Step 4: Create RLS Policies

**Location:** `supabase/setup/03_policies.sql`

```sql
-- =====================================================
-- LIBRARY MANAGEMENT RLS POLICIES
-- =====================================================
-- Created: 2025-01-27
-- Performance: Indexed on institution_id, member_id, book_id

-- =====================================================
-- LIBRARY_CATEGORIES POLICIES
-- =====================================================

CREATE POLICY "Users view own institution library_categories"
ON public.library_categories
FOR SELECT
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
);

CREATE POLICY "Librarians manage library_categories"
ON public.library_categories
FOR ALL
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
)
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
);

-- =====================================================
-- LIBRARY_BOOKS POLICIES
-- =====================================================

CREATE POLICY "Users view own institution library_books"
ON public.library_books
FOR SELECT
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
);

CREATE POLICY "Librarians manage library_books"
ON public.library_books
FOR ALL
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
)
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
);

-- =====================================================
-- LIBRARY_MEMBERS POLICIES
-- =====================================================

CREATE POLICY "Users view own institution library_members"
ON public.library_members
FOR SELECT
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
);

CREATE POLICY "Librarians manage library_members"
ON public.library_members
FOR ALL
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
)
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
);

-- =====================================================
-- LIBRARY_BORROWING POLICIES
-- =====================================================

CREATE POLICY "Users view own institution library_borrowing"
ON public.library_borrowing
FOR SELECT
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
);

CREATE POLICY "Librarians manage library_borrowing"
ON public.library_borrowing
FOR ALL
TO authenticated
USING (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
)
WITH CHECK (
    (SELECT auth.has_institution_access(institution_id))
    AND (SELECT auth.jwt()->>'role') IN ('admin', 'librarian')
);
```

## Step 5: Create TypeScript Types

**Location:** `types/library.ts`

```typescript
// Library Management Module Types

export interface LibraryCategory {
  id: string
  institution_id: string
  name: string
  description: string | null
  code: string | null
  parent_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LibraryBook {
  id: string
  institution_id: string
  title: string
  author: string
  isbn: string | null
  publisher: string | null
  published_year: number | null
  edition: string | null
  total_copies: number
  available_copies: number
  category_id: string | null
  location: string | null
  description: string | null
  status: 'available' | 'maintenance' | 'retired'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LibraryMember {
  id: string
  institution_id: string
  student_id: string | null
  staff_id: string | null
  member_type: 'student' | 'staff'
  membership_number: string
  membership_date: string
  expiry_date: string
  max_books: number
  max_days: number
  status: 'active' | 'suspended' | 'expired'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LibraryBorrowing {
  id: string
  institution_id: string
  member_id: string
  book_id: string
  borrowed_date: string
  due_date: string
  returned_date: string | null
  status: 'borrowed' | 'returned' | 'overdue' | 'lost'
  fine_amount: number
  fine_paid: boolean
  remarks: string | null
  borrowed_by: string | null
  returned_to: string | null
  created_at: string
  updated_at: string
}

// Filters
export interface LibraryBookFilters {
  institution_id: string
  category_id?: string
  status?: LibraryBook['status']
  search?: string
}

export interface LibraryBorrowingFilters {
  institution_id: string
  member_id?: string
  book_id?: string
  status?: LibraryBorrowing['status']
  from_date?: string
  to_date?: string
}
```

## Step 6: Create Service Layer

**Location:** `lib/services/library/library-service.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import type { LibraryBook, LibraryBookFilters } from '@/types/library'

export class LibraryService {
  static async getBooks(filters: LibraryBookFilters) {
    const supabase = await createClient()

    let query = supabase
      .from('library_books')
      .select(`
        *,
        category:library_categories(id, name)
      `)
      .eq('institution_id', filters.institution_id)

    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,author.ilike.%${filters.search}%`)
    }

    const { data, error } = await query.order('title')

    if (error) throw error

    return data as LibraryBook[]
  }

  static async getBook(id: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('library_books')
      .select(`
        *,
        category:library_categories(id, name)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return data as LibraryBook
  }

  // Add more methods as needed...
}
```

## Step 7: Create React Query Hooks

**Location:** `hooks/library/use-library-books.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { LibraryService } from '@/lib/services/library/library-service'
import type { LibraryBookFilters } from '@/types/library'

export function useLibraryBooks(filters: LibraryBookFilters) {
  return useQuery({
    queryKey: ['library-books', filters],
    queryFn: () => LibraryService.getBooks(filters),
  })
}

export function useLibraryBook(id: string) {
  return useQuery({
    queryKey: ['library-book', id],
    queryFn: () => LibraryService.getBook(id),
    enabled: !!id,
  })
}
```

## Step 8: Update SQL_FILE_INDEX.md

**Location:** `supabase/SQL_FILE_INDEX.md`

Add entries:

```markdown
### library_categories
- **File**: `supabase/setup/01_tables.sql`
- **Purpose**: Book categories for library organization
- **Created**: 2025-01-27
- **RLS**: Enabled
- **Policies**: supabase/setup/03_policies.sql

### library_books
- **File**: `supabase/setup/01_tables.sql`
- **Purpose**: Book inventory for library management
- **Created**: 2025-01-27
- **RLS**: Enabled
- **Policies**: supabase/setup/03_policies.sql

### library_members
- **File**: `supabase/setup/01_tables.sql`
- **Purpose**: Library membership for students and staff
- **Created**: 2025-01-27
- **RLS**: Enabled
- **Policies**: supabase/setup/03_policies.sql

### library_borrowing
- **File**: `supabase/setup/01_tables.sql`
- **Purpose**: Book borrowing transactions and history
- **Created**: 2025-01-27
- **RLS**: Enabled
- **Policies**: supabase/setup/03_policies.sql

**Last Updated**: 2025-01-27
```

## Module Creation Checklist

- [ ] Checked SQL_FILE_INDEX.md for existing tables
- [ ] Designed all needed tables for module
- [ ] Updated ONLY supabase/setup/01_tables.sql
- [ ] Added proper comments and descriptions
- [ ] Enabled RLS on all tables
- [ ] Created all necessary indexes
- [ ] Added update triggers
- [ ] Created RLS policies in 03_policies.sql
- [ ] Wrapped all auth functions in SELECT
- [ ] Created indexes for policy columns
- [ ] Created TypeScript types in types/
- [ ] Created service layer in lib/services/
- [ ] Created React Query hooks in hooks/
- [ ] Updated SQL_FILE_INDEX.md
- [ ] Tested queries in Supabase Dashboard
- [ ] Verified RLS policies work correctly

## Common Patterns for MyJKKN Modules

### 1. Reference Tables (Categories, Types)
- Simple structure: id, institution_id, name, code
- Parent-child relationships with parent_id
- Usually have soft delete

### 2. Master Tables (Main entities)
- Full audit columns
- Multiple foreign keys
- Complex business logic
- Many indexes for performance

### 3. Transaction Tables (Activities, History)
- Links between master tables
- Date/time tracking
- Status workflow
- Immutable once completed

### 4. Junction Tables (Many-to-many)
- Two foreign keys minimum
- Compound unique constraints
- Simple structure
- Fast lookups with indexes

This template provides a complete, real-world example of creating a module following all MyJKKN conventions.
