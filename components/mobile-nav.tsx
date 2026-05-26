'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SAFFRON = '#FD7215';
const GRAY = '#9CA3AF'; // gray-400

const HIDDEN_PREFIXES = ['/yifi/reveal', '/yi-future', '/yip'];
const SHOWN_PREFIXES = ['/dashboard', '/events', '/me', '/members', '/finance', '/home'];

const NAV_ITEMS = [
  {
    label: 'Home',
    href: '/dashboard',
    match: ['/dashboard', '/home'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? SAFFRON : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    label: 'Events',
    href: '/events',
    match: ['/events'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? SAFFRON : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    label: 'YiFi',
    href: '/yifi',
    match: ['/yifi'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? SAFFRON : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  {
    label: 'Connections',
    href: '/members',
    match: ['/members'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? SAFFRON : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <circle cx="18" cy="7" r="2.5" />
        <path d="M21 21v-1.5a3.5 3.5 0 0 0-2-3.18" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    href: '/me/journey',
    match: ['/me'],
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? SAFFRON : GRAY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();

  // Never show on projector / dedicated layout routes
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  // Only show on member-facing routes
  if (!SHOWN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {NAV_ITEMS.map(({ label, href, match, icon }) => {
          const active = match.some((prefix) => pathname.startsWith(prefix));
          return (
            <Link
              key={label}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            >
              {icon(active)}
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? SAFFRON : GRAY }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
