'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BottomNavMoreMenuProps } from './types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

export function BottomNavMoreMenu({
  groups,
  isOpen,
  onClose,
  onItemClick
}: BottomNavMoreMenuProps) {
  const pathname = usePathname();

  const handleItemClick = (href: string) => {
    onItemClick(href);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[80vh] rounded-t-3xl flex flex-col z-[90]"
      >
        <SheetHeader className="pb-2 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">All Menus</SheetTitle>
        </SheetHeader>

        {/* Custom scrollable area with hidden scrollbar */}
        <div
          className="flex-1 overflow-y-auto pb-8"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          <Accordion type="multiple" className="w-full" defaultValue={groups.map(g => g.id)}>
            {groups.map((group) => {
              const GroupIcon = group.icon;
              const hasActiveItem = group.menus.some(
                (item) =>
                  pathname === item.href || pathname.startsWith(item.href + '/')
              );

              return (
                <AccordionItem
                  key={group.id}
                  value={group.id}
                  className="border-b border-border/30"
                >
                  <AccordionTrigger
                    className={cn(
                      'py-3 hover:no-underline',
                      hasActiveItem && 'text-primary'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          hasActiveItem
                            ? 'bg-primary/10'
                            : 'bg-muted'
                        )}
                      >
                        <GroupIcon
                          className="h-4 w-4"
                          strokeWidth={hasActiveItem ? 2.5 : 2}
                        />
                      </div>
                      <span className="font-medium text-sm">
                        {group.groupLabel}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto mr-2">
                        {group.menus.length}
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="grid grid-cols-3 gap-2 pt-2 pb-3">
                      {group.menus.map((item, index) => {
                        const isActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + '/');
                        const Icon = item.icon;

                        return (
                          <motion.button
                            key={item.href}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                              transition: { delay: index * 0.02 }
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleItemClick(item.href)}
                            className={cn(
                              'flex flex-col items-center justify-center p-3 rounded-lg',
                              'transition-colors duration-200',
                              'active:bg-accent',
                              isActive
                                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                                : 'text-muted-foreground bg-muted/30'
                            )}
                          >
                            <Icon
                              className="h-5 w-5 mb-1"
                              strokeWidth={isActive ? 2.5 : 2}
                            />
                            <span
                              className={cn(
                                'text-[10px] text-center leading-tight line-clamp-2',
                                isActive && 'font-semibold'
                              )}
                            >
                              {item.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}
