'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BottomNavSubmenuProps } from './types';
import { usePathname } from 'next/navigation';

// Fast spring for container
const containerSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 0.8
};

// Quick exit transition
const exitTransition = {
  type: 'tween' as const,
  duration: 0.15,
  ease: [0.4, 0, 1, 1] as const
};

export function BottomNavSubmenu({
  items,
  isOpen,
  onItemClick
}: BottomNavSubmenuProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: 'auto',
            opacity: 1
          }}
          exit={{
            height: 0,
            opacity: 0
          }}
          transition={{
            height: containerSpring,
            opacity: { duration: 0.12 }
          }}
          className="overflow-hidden border-t border-border bg-background"
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{
              y: { type: 'spring', stiffness: 500, damping: 30 },
              opacity: { duration: 0.1 }
            }}
            className="p-3 max-h-[50vh] overflow-y-auto"
          >
            <div className="grid grid-cols-3 gap-2">
              {items.map((item, index) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.href}
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 25,
                      delay: index * 0.02 // Faster stagger
                    }}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02, backgroundColor: 'var(--accent)' }}
                    onClick={() => onItemClick(item.href)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-xl',
                      'transition-colors duration-100',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        rotate: isActive ? [0, -3, 3, 0] : 0
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <Icon
                        className="h-5 w-5 mb-1"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </motion.div>
                    <span
                      className={cn(
                        'text-[10px] text-center leading-tight line-clamp-2',
                        isActive && 'font-semibold'
                      )}
                    >
                      {item.label}
                    </span>
                    {item.parentLabel && (
                      <span className="text-[8px] text-muted-foreground/70 mt-0.5 truncate max-w-full">
                        {item.parentLabel}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
