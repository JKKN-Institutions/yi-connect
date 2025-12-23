'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BottomNavItemProps } from './types';

// Fast spring for snappy interactions
const tapSpring = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 25
};

// Smooth spring for icon animations
const iconSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 20
};

// Very fast spring for indicator
const indicatorSpring = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 30
};

export function BottomNavItem({
  id,
  icon: Icon,
  label,
  isActive,
  hasSubmenu,
  badgeCount,
  onClick
}: BottomNavItemProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center px-2 py-2 min-w-[64px] flex-1',
        'transition-colors duration-150',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}
      whileTap={{ scale: 0.92 }}
      transition={tapSpring}
    >
      <motion.div
        className="relative"
        animate={{
          scale: isActive ? 1.15 : 1,
          y: isActive ? -3 : 0
        }}
        transition={iconSpring}
      >
        <motion.div
          animate={{
            rotate: isActive ? [0, -5, 5, 0] : 0
          }}
          transition={{
            duration: 0.3,
            ease: 'easeOut'
          }}
        >
          <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
        </motion.div>

        {/* Badge for notifications */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 700, damping: 20 }}
            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </motion.span>
        )}
      </motion.div>

      <motion.span
        className={cn(
          'text-[10px] mt-1 font-medium truncate max-w-full',
          isActive && 'font-semibold'
        )}
        animate={{
          opacity: isActive ? 1 : 0.7,
          y: isActive ? 1 : 0
        }}
        transition={{ duration: 0.15 }}
      >
        {label}
      </motion.span>

      {/* Active indicator with smooth slide */}
      {isActive && (
        <motion.div
          layoutId="bottomNavActiveIndicator"
          className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary"
          transition={indicatorSpring}
        />
      )}
    </motion.button>
  );
}
