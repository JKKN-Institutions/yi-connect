/**
 * User Menu Component
 *
 * Dropdown menu for user profile and sign out.
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Settings, LogOut, ShieldCheck } from 'lucide-react'

interface UserMenuProps {
  profile: {
    full_name: string
    email: string
    avatar_url?: string | null
    roles?: Array<{
      role_name: string
      hierarchy_level: number
    }>
  } | null
}

export function UserMenu({ profile }: UserMenuProps) {
  // Mounted state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!profile) return null

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Sort roles by hierarchy level (highest first)
  const sortedRoles = profile.roles?.sort((a, b) =>
    (b.hierarchy_level || 0) - (a.hierarchy_level || 0)
  ) || []

  // Get the primary role (highest hierarchy level) - only after mount
  const primaryRole = mounted ? sortedRoles[0] : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {primaryRole && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[10px] font-semibold text-white shadow-md">
              {primaryRole.role_name.charAt(0)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{profile.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
            {sortedRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sortedRoles.map((role, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {role.role_name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={async (e) => {
            e.preventDefault()
            await signOut()
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
