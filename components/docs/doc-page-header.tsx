/**
 * Documentation Page Header Component
 *
 * Reusable header for documentation pages with icon, title, and description.
 * Responsive design with stacked layout on mobile.
 */

import { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DocPageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  moduleNumber?: number;
}

export function DocPageHeader({
  title,
  description,
  icon: Icon,
  moduleNumber
}: DocPageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8 pb-4 sm:pb-6 border-b">
      {/* Mobile: Stacked layout, Desktop: Side-by-side */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            {moduleNumber && (
              <Badge variant="outline" className="text-xs shrink-0">
                Module {moduleNumber}
              </Badge>
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
