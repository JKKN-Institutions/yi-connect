/**
 * Public Layout
 *
 * Layout for public pages (apply, about, etc.)
 * No authentication required
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Yi Connect',
    default: 'Yi Connect',
  },
  description: 'Young Indians Chapter Management System',
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className='min-h-screen bg-background'>
      {/* Simple Header */}
      <header className='border-b'>
        <div className='container mx-auto px-4 h-16 flex items-center justify-between'>
          <div className='text-xl font-bold'>Yi Connect</div>
          <nav className='flex gap-4'>
            <a href='/' className='text-sm hover:underline'>
              Home
            </a>
            <a href='/login' className='text-sm hover:underline'>
              Login
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className='container mx-auto px-4 py-8'>{children}</main>

      {/* Footer */}
      <footer className='border-t mt-auto'>
        <div className='container mx-auto px-4 py-6 text-center text-sm text-muted-foreground'>
          © 2025 Yi Connect. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
