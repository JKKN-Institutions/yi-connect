'use client';

import { motion } from 'framer-motion';
import {
  X,
  Home,
  Users,
  TabletSmartphone,
  Building,
  GraduationCap,
  CalendarClock,
  Package,
  ClipboardCheck,
  FileText,
  Bell,
  Settings,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActivePageInfo } from './types';

// Icon mapping for menu groups (same as in bottom-navbar.tsx)
const GROUP_ICONS: Record<string, LucideIcon> = {
  'Overview': Home,
  'User Management': Users,
  'Applications': TabletSmartphone,
  'Application Management': TabletSmartphone,
  'Organization Management': Building,
  'Learners Management': GraduationCap,
  'Facilitators Management': Users,
  'Academic Management': CalendarClock,
  'Resource Management': Package,
  'Admissions Management': ClipboardCheck,
  'Billing Management': FileText,
  'Administration': Bell,
  'System': Settings
};

interface BottomNavMinimizedProps {
  activePage: ActivePageInfo | { href: string; label: string; groupLabel: string };
  onExpand: () => void;
}

// Fast, smooth spring config
const springConfig = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 0.8
};

// Quick tween for opacity
const fadeConfig = {
  type: 'tween' as const,
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1] as const
};

export function BottomNavMinimized({
  activePage,
  onExpand
}: BottomNavMinimizedProps) {
  // Get icon from activePage or look up from GROUP_ICONS using groupLabel
  const Icon = ('icon' in activePage && typeof activePage.icon === 'function')
    ? activePage.icon
    : GROUP_ICONS[activePage.groupLabel] || Home;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={springConfig}
      className={cn(
        'fixed bottom-4 left-4 right-4 z-[80] lg:hidden'
      )}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Active page pill - full width design with solid background */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        transition={springConfig}
        className={cn(
          'flex items-center justify-between w-full px-3 py-3 rounded-2xl',
          'bg-card dark:bg-card',
          'shadow-xl shadow-black/15 dark:shadow-black/30',
          'border border-border'
        )}
      >
        {/* Left section - clickable to expand */}
        <motion.button
          onClick={onExpand}
          className="flex items-center gap-3 flex-1 min-w-0"
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 600, damping: 25 }}
        >
          {/* Icon circle with primary color */}
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ ...springConfig, delay: 0.05 }}
            className={cn(
              'flex items-center justify-center flex-shrink-0',
              'w-11 h-11 rounded-xl',
              'bg-primary',
              'text-primary-foreground'
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </motion.div>

          {/* Text content */}
          <motion.div
            initial={{ x: -15, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ ...fadeConfig, delay: 0.08 }}
            className="flex flex-col items-start min-w-0"
          >
            {/* Group label on top (small, muted) */}
            <span className="text-xs text-muted-foreground leading-tight">
              {activePage.groupLabel}
            </span>
            {/* Page label below (bold, dark) */}
            <span className="text-sm font-semibold text-foreground leading-tight truncate max-w-[200px]">
              {activePage.label}
            </span>
          </motion.div>
        </motion.button>

        {/* Close button on the right with primary dark variant */}
        <motion.button
          initial={{ scale: 0, rotate: 90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...springConfig, delay: 0.1 }}
          onClick={onExpand}
          className={cn(
            'flex items-center justify-center flex-shrink-0',
            'w-10 h-10 rounded-full',
            'bg-foreground/90 dark:bg-foreground/80',
            'text-background',
            'transition-all duration-150',
            'hover:bg-foreground hover:scale-105',
            'active:scale-95'
          )}
          whileTap={{ scale: 0.9 }}
        >
          <X className="h-5 w-5" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
