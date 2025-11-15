'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { SkillGapAnalysis } from '@/types/member';

interface SkillsGapChartProps {
  skillGaps: SkillGapAnalysis[];
}

export function SkillsGapChart({ skillGaps }: SkillsGapChartProps) {
  // Sort by gap severity
  const sortedGaps = useMemo(() => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...skillGaps].sort(
      (a, b) => severityOrder[a.gap_severity] - severityOrder[b.gap_severity]
    );
  }, [skillGaps]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className='h-4 w-4 text-red-600' />;
      case 'high':
        return <AlertCircle className='h-4 w-4 text-orange-600' />;
      case 'medium':
        return <Info className='h-4 w-4 text-yellow-600' />;
      case 'low':
        return <CheckCircle className='h-4 w-4 text-green-600' />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string): 'destructive' | 'default' | 'secondary' | 'outline' => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getProgressColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'medium':
        return 'bg-yellow-600';
      case 'low':
        return 'bg-green-600';
      default:
        return 'bg-gray-600';
    }
  };

  if (sortedGaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Skills Gap Analysis</CardTitle>
          <CardDescription>
            No skill gap data available for your chapter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
            <Info className='h-12 w-12 mb-4' />
            <p>Add skills to members to see gap analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills Gap Analysis</CardTitle>
        <CardDescription>
          Identify critical skill shortages and development opportunities across {skillGaps.length} skills
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          {/* Summary Stats */}
          <div className='grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-red-600'>
                {sortedGaps.filter(g => g.gap_severity === 'critical').length}
              </div>
              <div className='text-xs text-muted-foreground'>Critical</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-orange-600'>
                {sortedGaps.filter(g => g.gap_severity === 'high').length}
              </div>
              <div className='text-xs text-muted-foreground'>High</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-yellow-600'>
                {sortedGaps.filter(g => g.gap_severity === 'medium').length}
              </div>
              <div className='text-xs text-muted-foreground'>Medium</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-green-600'>
                {sortedGaps.filter(g => g.gap_severity === 'low').length}
              </div>
              <div className='text-xs text-muted-foreground'>Low</div>
            </div>
          </div>

          {/* Skills List */}
          <div className='space-y-4'>
            {sortedGaps.slice(0, 15).map((gap) => (
              <div key={gap.skill_id} className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    {getSeverityIcon(gap.gap_severity)}
                    <span className='font-medium'>{gap.skill_name}</span>
                    <Badge variant='outline' className='text-xs'>
                      {gap.skill_category}
                    </Badge>
                    <Badge variant={getSeverityColor(gap.gap_severity)} className='text-xs'>
                      {gap.gap_severity}
                    </Badge>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {gap.total_members_with_skill} members • {gap.mentors_available} mentors
                  </div>
                </div>

                {/* Proficiency Distribution */}
                <div className='grid grid-cols-4 gap-2'>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Beginner</span>
                      <span>{gap.beginner_count}</span>
                    </div>
                    <Progress
                      value={(gap.beginner_count / gap.total_members_with_skill) * 100}
                      className='h-1'
                    />
                  </div>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Intermediate</span>
                      <span>{gap.intermediate_count}</span>
                    </div>
                    <Progress
                      value={(gap.intermediate_count / gap.total_members_with_skill) * 100}
                      className='h-1'
                    />
                  </div>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Advanced</span>
                      <span>{gap.advanced_count}</span>
                    </div>
                    <Progress
                      value={(gap.advanced_count / gap.total_members_with_skill) * 100}
                      className='h-1'
                    />
                  </div>
                  <div className='space-y-1'>
                    <div className='flex justify-between text-xs'>
                      <span className='text-muted-foreground'>Expert</span>
                      <span>{gap.expert_count}</span>
                    </div>
                    <Progress
                      value={(gap.expert_count / gap.total_members_with_skill) * 100}
                      className='h-1'
                    />
                  </div>
                </div>

                <div className='flex items-center gap-4 text-xs text-muted-foreground'>
                  <span>Avg Proficiency: {gap.avg_proficiency.toFixed(1)}/5</span>
                  {gap.mentors_available === 0 && (
                    <span className='text-amber-600 font-medium'>⚠ No mentors available</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {sortedGaps.length > 15 && (
            <p className='text-sm text-muted-foreground text-center pt-4'>
              Showing top 15 of {sortedGaps.length} skills
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
