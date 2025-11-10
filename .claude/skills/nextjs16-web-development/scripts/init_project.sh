#!/bin/bash
#
# Next.js 16 Project Initialization Script
#
# Initializes a new Next.js 16 project with standardized structure,
# dependencies, and configuration for team development.
#
# Usage: ./init_project.sh <project-name>
#

set -e  # Exit on error

PROJECT_NAME=$1

if [ -z "$PROJECT_NAME" ]; then
  echo "❌ Error: Project name is required"
  echo "Usage: ./init_project.sh <project-name>"
  exit 1
fi

echo "🚀 Initializing Next.js 16 project: $PROJECT_NAME"
echo ""

# Create Next.js app with Turbopack
echo "📦 Creating Next.js 16 app with Turbopack..."
npx create-next-app@latest "$PROJECT_NAME" \
  --typescript \
  --tailwind \
  --app \
  --turbopack \
  --no-src-dir \
  --import-alias "@/*"

cd "$PROJECT_NAME"

echo ""
echo "📦 Installing core dependencies..."

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr

# Validation & Forms
npm install zod react-hook-form @hookform/resolvers

# Data fetching & state
npm install @tanstack/react-table @tanstack/react-query

# Utilities
npm install date-fns clsx tailwind-merge class-variance-authority
npm install lucide-react next-themes

# Dev dependencies
npm install --save-dev @types/node prettier eslint-config-prettier

echo ""
echo "📁 Creating standard directory structure..."

# Create directory structure
mkdir -p app/\(auth\)/login
mkdir -p app/\(auth\)/register
mkdir -p app/\(dashboard\)
mkdir -p app/actions
mkdir -p app/api/webhooks
mkdir -p lib/supabase
mkdir -p lib/data
mkdir -p lib/validations
mkdir -p lib/utils
mkdir -p lib/hooks
mkdir -p components/ui
mkdir -p components/shared
mkdir -p components/forms
mkdir -p components/layouts
mkdir -p types
mkdir -p config
mkdir -p public/uploads

echo ""
echo "⚙️ Creating configuration files..."

# Create next.config.ts with Cache Components
cat > next.config.ts << 'EOF'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable Cache Components and PPR
  cacheComponents: true,

  // Configure cache lifecycle profiles
  cacheLife: {
    // Predefined profiles
    default: { expire: 3600 },
    seconds: { expire: 5 },
    minutes: { expire: 60 },
    hours: { expire: 3600 },
    days: { expire: 86400 },
    weeks: { expire: 604800 },
    max: { expire: Number.MAX_SAFE_INTEGER },

    // Custom profiles
    realtime: { expire: 1 },
    frequent: { expire: 30 },
    moderate: { expire: 300 },
    stable: { expire: 3600 },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

export default nextConfig
EOF

# Create Supabase server client
cat > lib/supabase/server.ts << 'EOF'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
EOF

# Create Supabase client client
cat > lib/supabase/client.ts << 'EOF'
import { createBrowserClient } from '@supabase/ssr'

export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
EOF

# Create auth utilities
cat > lib/auth.ts << 'EOF'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function requireRole(allowedRoles: string[]) {
  const user = await requireAuth()
  const supabase = await createServerSupabaseClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) {
    redirect('/unauthorized')
  }

  return { user, role: profile.role }
}
EOF

# Create cn utility
cat > lib/utils/cn.ts << 'EOF'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

# Create .env.local template
cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF

# Create prettier config
cat > .prettierrc << 'EOF'
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
EOF

# Create README with setup instructions
cat > README.md << 'EOF'
# Next.js 16 Application

Production-ready Next.js 16 application with Cache Components, Server Actions, and Supabase.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure environment variables:
   - Copy \`.env.local\` and add your Supabase credentials
   - Update \`NEXT_PUBLIC_SUPABASE_URL\` and \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`

3. Run development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## Project Structure

\`\`\`
app/
├── (auth)/              # Auth routes group
├── (dashboard)/         # Protected routes group
├── actions/             # Server Actions by module
└── api/                 # API routes (webhooks only)
lib/
├── supabase/           # Supabase clients
├── data/               # Cached data fetching
├── validations/        # Zod schemas
└── utils/              # Utilities
components/
├── ui/                 # UI components
├── shared/             # Shared components
└── forms/              # Form components
types/                  # TypeScript types
config/                 # App configuration
\`\`\`

## Development

- \`npm run dev\` - Start development server with Turbopack
- \`npm run build\` - Build for production
- \`npm run lint\` - Run ESLint
- \`npm run type-check\` - Run TypeScript type checking

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod
- **Styling**: Tailwind CSS
- **TypeScript**: Strict mode enabled
EOF

echo ""
echo "✅ Project initialization complete!"
echo ""
echo "Next steps:"
echo "1. cd $PROJECT_NAME"
echo "2. Update .env.local with your Supabase credentials"
echo "3. npm run dev"
echo ""
echo "📚 Refer to the Next.js 16 Web Development skill for:"
echo "   - Module development workflows"
echo "   - Caching strategies"
echo "   - Server Actions patterns"
echo "   - Database schema design"
