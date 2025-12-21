'use client';

/**
 * Quadrant Summary Cards
 *
 * Displays summary statistics for each quadrant of the Skill/Will Matrix.
 */

import { Star, Rocket, AlertTriangle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { QuadrantSummary, MatrixMember } from '@/lib/data/skill-will-matrix';
import { QUADRANT_CONFIG } from '@/lib/data/skill-will-matrix-config';
import type { SkillWillCategory } from '@/types/member';

interface QuadrantCardsProps {
  quadrants: {
    star: QuadrantSummary;
    enthusiast: QuadrantSummary;
    cynic: QuadrantSummary;
    dead_wood: QuadrantSummary;
  };
  onQuadrantClick?: (category: SkillWillCategory) => void;
}

const ICONS = {
  star: Star,
  enthusiast: Rocket,
  cynic: AlertTriangle,
  dead_wood: AlertCircle,
} as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function QuadrantCard({
  summary,
  onQuadrantClick,
}: {
  summary: QuadrantSummary;
  onQuadrantClick?: (category: SkillWillCategory) => void;
}) {
  const config = QUADRANT_CONFIG[summary.category];
  const Icon = ICONS[summary.category];
  const topMembers = summary.members.slice(0, 3);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg border-l-4',
        `hover:border-l-[${config.color}]`
      )}
      style={{ borderLeftColor: config.color }}
      onClick={() => onQuadrantClick?.(summary.category)}
    >
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div
              className='p-2 rounded-lg'
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className='h-5 w-5' style={{ color: config.color }} />
            </div>
            <div>
              <CardTitle className='text-lg'>{config.label}</CardTitle>
              <CardDescription className='text-xs'>
                {config.description}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant='secondary'
            className='text-lg font-bold px-3'
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {summary.count}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className='grid grid-cols-2 gap-2 mb-4'>
          <div className='bg-muted/50 rounded-lg p-2 text-center'>
            <p className='text-xs text-muted-foreground'>Avg Skill</p>
            <p className='text-lg font-bold'>{summary.avg_skill}%</p>
          </div>
          <div className='bg-muted/50 rounded-lg p-2 text-center'>
            <p className='text-xs text-muted-foreground'>Avg Will</p>
            <p className='text-lg font-bold'>{summary.avg_will}%</p>
          </div>
        </div>

        {/* Action */}
        <div className='mb-4'>
          <p className='text-xs text-muted-foreground'>Recommended Action</p>
          <p className='text-sm font-medium'>{config.action}</p>
        </div>

        {/* Top Members */}
        {topMembers.length > 0 && (
          <div>
            <p className='text-xs text-muted-foreground mb-2'>Members</p>
            <div className='flex -space-x-2'>
              {topMembers.map((member) => (
                <Avatar
                  key={member.id}
                  className='h-8 w-8 border-2 border-background'
                  title={member.full_name}
                >
                  <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
                  <AvatarFallback className='text-xs'>
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {summary.count > 3 && (
                <div className='h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center'>
                  <span className='text-xs font-medium'>+{summary.count - 3}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {summary.count === 0 && (
          <p className='text-sm text-muted-foreground text-center py-2'>
            No members in this quadrant
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function QuadrantCards({ quadrants, onQuadrantClick }: QuadrantCardsProps) {
  // Order: Star (top-right), Enthusiast (top-left), Cynic (bottom-right), Dead Wood (bottom-left)
  const orderedQuadrants: SkillWillCategory[] = ['star', 'enthusiast', 'cynic', 'dead_wood'];

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {orderedQuadrants.map((category) => (
        <QuadrantCard
          key={category}
          summary={quadrants[category]}
          onQuadrantClick={onQuadrantClick}
        />
      ))}
    </div>
  );
}
