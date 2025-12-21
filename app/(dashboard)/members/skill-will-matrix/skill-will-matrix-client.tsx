'use client';

/**
 * Skill/Will Matrix Client Component
 *
 * Handles client-side interactivity for the Skill/Will Matrix feature.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MatrixData, MatrixMember } from '@/lib/data/skill-will-matrix';
import type { SkillWillCategory } from '@/types/member';
import { MatrixChart, QuadrantCards, MemberList } from '@/components/members/skill-will-matrix';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QUADRANT_CONFIG } from '@/lib/data/skill-will-matrix-config';

interface SkillWillMatrixClientProps {
  data: MatrixData;
}

export function SkillWillMatrixClient({ data }: SkillWillMatrixClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<SkillWillCategory | null>(null);

  const handleMemberClick = (member: MatrixMember) => {
    router.push(`/members/${member.id}`);
  };

  const handleQuadrantClick = (category: SkillWillCategory) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  return (
    <div className='space-y-6'>
      {/* Overview Stats */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Total Members</CardDescription>
            <CardTitle className='text-3xl'>{data.totals.total_members}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Active members in the chapter
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Average Skill Score</CardDescription>
            <CardTitle className='text-3xl'>{data.totals.avg_skill}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Based on proficiency, experience, leadership
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Average Will Score</CardDescription>
            <CardTitle className='text-3xl'>{data.totals.avg_will}%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Based on engagement, activity, contributions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quadrant Summary Cards */}
      <QuadrantCards
        quadrants={data.quadrants}
        onQuadrantClick={handleQuadrantClick}
      />

      {/* Matrix Chart */}
      <MatrixChart
        members={data.members}
        thresholds={data.thresholds}
        onMemberClick={handleMemberClick}
      />

      {/* Member List */}
      <MemberList
        members={data.members}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Legend / Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding the Matrix</CardTitle>
          <CardDescription>
            How to interpret and act on the Skill/Will Matrix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2'>
            {(['star', 'enthusiast', 'cynic', 'dead_wood'] as SkillWillCategory[]).map((category) => {
              const config = QUADRANT_CONFIG[category];
              return (
                <div
                  key={category}
                  className='flex items-start gap-3 p-3 rounded-lg border'
                  style={{ borderColor: `${config.color}40` }}
                >
                  <div
                    className='w-4 h-4 rounded-full mt-1 shrink-0'
                    style={{ backgroundColor: config.color }}
                  />
                  <div>
                    <p className='font-medium' style={{ color: config.color }}>
                      {config.label}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {config.description}
                    </p>
                    <p className='text-sm mt-1'>
                      <span className='font-medium'>Action:</span> {config.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className='mt-6 p-4 bg-muted/50 rounded-lg'>
            <h4 className='font-medium mb-2'>How Scores Are Calculated</h4>
            <div className='grid gap-4 md:grid-cols-2 text-sm'>
              <div>
                <p className='font-medium'>Skill Score</p>
                <ul className='text-muted-foreground list-disc list-inside'>
                  <li>Skill proficiency levels (35%)</li>
                  <li>Leadership assessment (25%)</li>
                  <li>Leadership experience (20%)</li>
                  <li>Years of experience (20%)</li>
                  <li>Mentoring bonus (up to +10)</li>
                </ul>
              </div>
              <div>
                <p className='font-medium'>Will Score</p>
                <ul className='text-muted-foreground list-disc list-inside'>
                  <li>Engagement score (50%)</li>
                  <li>Activity recency (25%)</li>
                  <li>Event organization ratio (15%)</li>
                  <li>Active membership status (10%)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
