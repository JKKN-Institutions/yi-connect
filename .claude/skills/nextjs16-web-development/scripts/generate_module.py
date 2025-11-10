#!/usr/bin/env python3
"""
Next.js 16 Module Generator

Generates a complete CRUD module with:
- TypeScript types and Zod schemas
- Cached data fetching functions
- Server Actions for mutations
- UI components (list, form, detail)
- Page routes with Suspense

Usage:
    python generate_module.py <module-name> [--singular] [--path .]

Examples:
    python generate_module.py products
    python generate_module.py blog-posts --singular post
    python generate_module.py users --path /path/to/project
"""

import sys
import os
from pathlib import Path

def to_pascal_case(text):
    """Convert hyphenated text to PascalCase"""
    return ''.join(word.capitalize() for word in text.split('-'))

def to_camel_case(text):
    """Convert hyphenated text to camelCase"""
    words = text.split('-')
    return words[0] + ''.join(word.capitalize() for word in words[1:])

def generate_module(module_name, singular=None, project_path='.'):
    """Generate a complete CRUD module"""

    if not singular:
        # Auto-generate singular by removing 's' if plural
        singular = module_name[:-1] if module_name.endswith('s') else module_name

    # Names for templates
    plural = module_name
    pascal_singular = to_pascal_case(singular)
    pascal_plural = to_pascal_case(plural)
    camel_singular = to_camel_case(singular)
    camel_plural = to_camel_case(plural)

    base_path = Path(project_path).resolve()

    print(f"🚀 Generating {pascal_singular} module...")
    print(f"   Plural: {plural}")
    print(f"   Singular: {singular}")
    print("")

    # Create directories
    types_dir = base_path / 'types'
    data_dir = base_path / 'lib' / 'data'
    actions_dir = base_path / 'app' / 'actions'
    routes_dir = base_path / 'app' / '(dashboard)' / plural
    components_dir = routes_dir / '_components'

    for dir in [types_dir, data_dir, actions_dir, components_dir]:
        dir.mkdir(parents=True, exist_ok=True)

    # Generate TypeScript types
    types_content = f'''// types/{singular}.ts
import {{ z }} from 'zod'

// Database entity
export interface {pascal_singular} {{
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}}

// Validation schemas
export const Create{pascal_singular}Schema = z.object({{
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name is too long'),
  description: z.string()
    .max(1000, 'Description is too long')
    .optional()
    .nullable(),
  is_active: z.boolean().default(true),
}})

export const Update{pascal_singular}Schema = Create{pascal_singular}Schema.partial()

export type Create{pascal_singular}Input = z.infer<typeof Create{pascal_singular}Schema>
export type Update{pascal_singular}Input = z.infer<typeof Update{pascal_singular}Schema>

// Filters
export interface {pascal_singular}Filters {{
  search?: string
  is_active?: boolean
  sort_by?: 'name' | 'created_at'
  sort_order?: 'asc' | 'desc'
}}

// Form state
export interface FormState {{
  errors?: {{
    [key: string]: string[]
  }}
  message?: string
  success?: boolean
}}
'''

    types_file = types_dir / f'{singular}.ts'
    types_file.write_text(types_content)
    print(f"✅ Created {types_file}")

    # Generate data layer
    data_content = f'''// lib/data/{plural}.ts
import {{ cacheTag, cacheLife }} from 'next/cache'
import {{ createServerSupabaseClient }} from '@/lib/supabase/server'
import type {{ {pascal_singular}, {pascal_singular}Filters }} from '@/types/{singular}'

export async function get{pascal_plural}(
  filters: {pascal_singular}Filters = {{}},
  page = 1,
  limit = 20
) {{
  'use cache'
  cacheLife('hours')
  cacheTag('{plural}')

  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('{plural}')
    .select('*', {{ count: 'exact' }})

  // Apply filters
  if (filters.search) {{
    query = query.ilike('name', `%${{filters.search}}%`)
  }}
  if (filters.is_active !== undefined) {{
    query = query.eq('is_active', filters.is_active)
  }}

  // Sorting
  const sortBy = filters.sort_by || 'created_at'
  const sortOrder = filters.sort_order || 'desc'
  query = query.order(sortBy, {{ ascending: sortOrder === 'asc' }})

  // Pagination
  const from = (page - 1) * limit
  const to = from + limit - 1
  query = query.range(from, to)

  const {{ data, error, count }} = await query

  if (error) throw error

  return {{
    data: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  }}
}}

export async function get{pascal_singular}(id: string) {{
  'use cache'
  cacheLife('hours')
  cacheTag('{plural}', `{singular}-${{id}}`)

  const supabase = await createServerSupabaseClient()

  const {{ data, error }} = await supabase
    .from('{plural}')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as {pascal_singular}
}}
'''

    data_file = data_dir / f'{plural}.ts'
    data_file.write_text(data_content)
    print(f"✅ Created {data_file}")

    # Generate Server Actions
    actions_content = f'''// app/actions/{plural}.ts
'use server'

import {{ updateTag }} from 'next/cache'
import {{ redirect }} from 'next/navigation'
import {{ createServerSupabaseClient }} from '@/lib/supabase/server'
import {{ requireAuth }} from '@/lib/auth'
import {{
  Create{pascal_singular}Schema,
  Update{pascal_singular}Schema,
  type FormState
}} from '@/types/{singular}'

export async function create{pascal_singular}(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {{
  try {{
    await requireAuth()

    const validation = Create{pascal_singular}Schema.safeParse({{
      name: formData.get('name'),
      description: formData.get('description'),
      is_active: formData.get('is_active') === 'true',
    }})

    if (!validation.success) {{
      return {{
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }}
    }}

    const supabase = await createServerSupabaseClient()

    const {{ data, error }} = await supabase
      .from('{plural}')
      .insert([validation.data])
      .select()
      .single()

    if (error) {{
      return {{
        message: 'Database error: Failed to create {singular}.',
      }}
    }}

    updateTag('{plural}')

    redirect(`/{plural}/${{data.id}}`)
  }} catch (error) {{
    return {{
      message: 'An unexpected error occurred.',
    }}
  }}
}}

export async function update{pascal_singular}(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {{
  try {{
    await requireAuth()

    const validation = Update{pascal_singular}Schema.safeParse({{
      name: formData.get('name'),
      description: formData.get('description'),
      is_active: formData.get('is_active') === 'true',
    }})

    if (!validation.success) {{
      return {{
        errors: validation.error.flatten().fieldErrors,
        message: 'Invalid fields. Please check the form.',
      }}
    }}

    const supabase = await createServerSupabaseClient()

    const {{ error }} = await supabase
      .from('{plural}')
      .update(validation.data)
      .eq('id', id)

    if (error) {{
      return {{
        message: 'Database error: Failed to update {singular}.',
      }}
    }}

    updateTag('{plural}')
    updateTag(`{singular}-${{id}}`)

    return {{
      success: true,
      message: '{pascal_singular} updated successfully!',
    }}
  }} catch (error) {{
    return {{
      message: 'An unexpected error occurred.',
    }}
  }}
}}

export async function delete{pascal_singular}(id: string) {{
  await requireAuth()

  const supabase = await createServerSupabaseClient()

  const {{ error }} = await supabase
    .from('{plural}')
    .delete()
    .eq('id', id)

  if (error) {{
    throw new Error('Failed to delete {singular}')
  }}

  updateTag('{plural}')
  redirect('/{plural}')
}}
'''

    actions_file = actions_dir / f'{plural}.ts'
    actions_file.write_text(actions_content)
    print(f"✅ Created {actions_file}")

    # Generate list page
    list_page_content = f'''// app/(dashboard)/{plural}/page.tsx
import {{ Suspense }} from 'react'
import {{ get{pascal_plural} }} from '@/lib/data/{plural}'
import {{ {pascal_singular}Table }} from './_components/{singular}-table'
import {{ {pascal_singular}TableSkeleton }} from './_components/{singular}-table-skeleton'

export default function {pascal_plural}Page({{
  searchParams,
}}: {{
  searchParams: Promise<{{ [key: string]: string | undefined }}>
}}) {{
  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{pascal_plural}</h1>
        <a
          href="/{plural}/new"
          className="btn btn-primary"
        >
          Create {pascal_singular}
        </a>
      </div>

      <Suspense fallback={{<{pascal_singular}TableSkeleton />}}>
        <{pascal_singular}List searchParams={{searchParams}} />
      </Suspense>
    </div>
  )
}}

async function {pascal_singular}List({{
  searchParams,
}}: {{
  searchParams: Promise<{{ [key: string]: string | undefined }}>
}}) {{
  const params = await searchParams

  const {camel_plural} = await get{pascal_plural}({{
    search: params.search,
    is_active: params.is_active === 'true',
  }})

  return <{pascal_singular}Table {camel_plural}={{{camel_plural}}} />
}}
'''

    (routes_dir / 'page.tsx').write_text(list_page_content)
    print(f"✅ Created {routes_dir}/page.tsx")

    # Generate form component
    form_component_content = f'''// app/(dashboard)/{plural}/_components/{singular}-form.tsx
'use client'

import {{ useActionState }} from 'react'
import {{ useFormStatus }} from 'react-dom'
import {{ create{pascal_singular}, update{pascal_singular} }} from '@/app/actions/{plural}'
import type {{ {pascal_singular} }} from '@/types/{singular}'

interface {pascal_singular}FormProps {{
  {camel_singular}?: {pascal_singular}
}}

export function {pascal_singular}Form({{ {camel_singular} }}: {pascal_singular}FormProps) {{
  const action = {camel_singular}
    ? update{pascal_singular}.bind(null, {camel_singular}.id)
    : create{pascal_singular}

  const [state, formAction] = useActionState(action, {{}})

  return (
    <form action={{formAction}} className="space-y-6">
      {{state.message && (
        <div className={{state.success ? 'alert-success' : 'alert-error'}}>
          {{state.message}}
        </div>
      )}}

      <div>
        <label htmlFor="name" className="label">
          Name *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={{{camel_singular}?.name}}
          required
          className="input"
          aria-invalid={{!!state.errors?.name}}
        />
        {{state.errors?.name && (
          <p className="error">{{state.errors.name[0]}}</p>
        )}}
      </div>

      <div>
        <label htmlFor="description" className="label">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={{4}}
          defaultValue={{{camel_singular}?.description}}
          className="textarea"
        />
        {{state.errors?.description && (
          <p className="error">{{state.errors.description[0]}}</p>
        )}}
      </div>

      <div className="flex items-center">
        <input
          id="is_active"
          name="is_active"
          type="checkbox"
          defaultChecked={{{camel_singular}?.is_active}}
          className="checkbox"
        />
        <label htmlFor="is_active" className="ml-2">
          Active
        </label>
      </div>

      <SubmitButton />
    </form>
  )
}}

function SubmitButton() {{
  const {{ pending }} = useFormStatus()

  return (
    <button
      type="submit"
      disabled={{pending}}
      className="btn btn-primary"
    >
      {{pending ? 'Saving...' : 'Save {pascal_singular}'}}
    </button>
  )
}}
'''

    (components_dir / f'{singular}-form.tsx').write_text(form_component_content)
    print(f"✅ Created {components_dir}/{singular}-form.tsx")

    print("")
    print(f"✅ {pascal_singular} module generated successfully!")
    print("")
    print("Next steps:")
    print(f"1. Create the '{plural}' table in Supabase")
    print(f"2. Update types in types/{singular}.ts to match your schema")
    print(f"3. Implement the table component in {components_dir}/{singular}-table.tsx")
    print(f"4. Add routes for create/edit/detail pages")
    print("")

def main():
    if len(sys.argv) < 2:
        print("Usage: python generate_module.py <module-name> [--singular name] [--path /path]")
        print("\nExamples:")
        print("  python generate_module.py products")
        print("  python generate_module.py blog-posts --singular post")
        sys.exit(1)

    module_name = sys.argv[1]
    singular = None
    project_path = '.'

    # Parse optional arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--singular' and i + 1 < len(sys.argv):
            singular = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == '--path' and i + 1 < len(sys.argv):
            project_path = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    generate_module(module_name, singular, project_path)

if __name__ == "__main__":
    main()
