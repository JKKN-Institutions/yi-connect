/**
 * Authentication Layout
 *
 * Layout for login and password reset pages.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Authentication - Yi Connect',
  description: 'Sign in to Yi Connect with Google',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-col lg:justify-between bg-linear-to-br from-primary via-primary/90 to-secondary p-12">
        <div>
          <Link href="/" className="flex items-center gap-2 text-white">
            <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <span className="text-2xl font-bold">Yi</span>
            </div>
            <span className="text-2xl font-bold">Yi Connect</span>
          </Link>
        </div>

        <div className="space-y-6 text-white">
          <h1 className="text-4xl font-bold">
            Empowering Young Indians,
            <br />
            Building Communities
          </h1>
          <p className="text-xl text-white/90">
            The comprehensive Yi Chapter Management System for streamlined operations,
            events, and member engagement.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="space-y-2">
              <div className="text-3xl font-bold">11</div>
              <div className="text-sm text-white/80">Integrated Modules</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">80%</div>
              <div className="text-sm text-white/80">Time Saved</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">100%</div>
              <div className="text-sm text-white/80">Data Visibility</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">2x</div>
              <div className="text-sm text-white/80">Faster Matching</div>
            </div>
          </div>
        </div>

        <div className="text-white/60 text-sm">
          © 2025 Yi Connect. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">Yi</span>
              </div>
              <span className="text-2xl font-bold">Yi Connect</span>
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
