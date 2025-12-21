'use client';

/**
 * Skill/Will Matrix Scatter Chart
 *
 * Interactive 2x2 quadrant visualization showing members
 * plotted by their Skill (X-axis) and Will (Y-axis) scores.
 */

import { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ZAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { MatrixMember } from '@/lib/data/skill-will-matrix';
import { QUADRANT_CONFIG } from '@/lib/data/skill-will-matrix-config';

interface MatrixChartProps {
  members: MatrixMember[];
  thresholds: { skill: number; will: number };
  onMemberClick?: (member: MatrixMember) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const member = payload[0].payload as MatrixMember;
  const config = QUADRANT_CONFIG[member.category];

  return (
    <Card className='shadow-lg border-2' style={{ borderColor: config.color }}>
      <CardContent className='p-3'>
        <div className='flex items-center gap-3'>
          <Avatar className='h-10 w-10'>
            <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className='font-semibold text-sm'>{member.full_name}</p>
            <p className='text-xs text-muted-foreground'>
              {member.designation || 'Member'}
              {member.company && ` at ${member.company}`}
            </p>
          </div>
        </div>
        <div className='grid grid-cols-2 gap-3 mt-3 text-xs'>
          <div className='bg-muted/50 rounded p-2'>
            <span className='text-muted-foreground'>Skill Score</span>
            <p className='font-bold text-lg'>{member.skill_score}</p>
          </div>
          <div className='bg-muted/50 rounded p-2'>
            <span className='text-muted-foreground'>Will Score</span>
            <p className='font-bold text-lg'>{member.will_score}</p>
          </div>
        </div>
        <div className='mt-2 flex items-center gap-2'>
          <div
            className='w-3 h-3 rounded-full'
            style={{ backgroundColor: config.color }}
          />
          <span className='text-xs font-medium' style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
        {member.top_skill && (
          <p className='text-xs text-muted-foreground mt-1'>
            Top skill: {member.top_skill}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MatrixChart({ members, thresholds, onMemberClick }: MatrixChartProps) {
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);

  // Add small random offset to prevent overlap
  const chartData = useMemo(() => {
    return members.map((member) => ({
      ...member,
      // Add tiny offset for members at exact same position
      x: member.skill_score + (Math.random() - 0.5) * 2,
      y: member.will_score + (Math.random() - 0.5) * 2,
    }));
  }, [members]);

  return (
    <Card className='col-span-full'>
      <CardHeader>
        <CardTitle>Skill/Will Matrix</CardTitle>
        <CardDescription>
          Click on a member to view their details. Quadrant thresholds at {thresholds.skill}% skill, {thresholds.will}% will.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='h-[500px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
            >
              <CartesianGrid strokeDasharray='3 3' opacity={0.3} />
              <XAxis
                type='number'
                dataKey='x'
                domain={[0, 100]}
                name='Skill'
                label={{
                  value: 'SKILL →',
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fill: '#888', fontSize: 12 },
                }}
                tickFormatter={(value) => `${value}`}
              />
              <YAxis
                type='number'
                dataKey='y'
                domain={[0, 100]}
                name='Will'
                label={{
                  value: '← WILL',
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: '#888', fontSize: 12 },
                }}
                tickFormatter={(value) => `${value}`}
              />
              <ZAxis range={[80, 80]} />

              {/* Threshold lines */}
              <ReferenceLine
                x={thresholds.skill}
                stroke='#888'
                strokeDasharray='5 5'
                strokeWidth={2}
              />
              <ReferenceLine
                y={thresholds.will}
                stroke='#888'
                strokeDasharray='5 5'
                strokeWidth={2}
              />

              {/* Quadrant labels */}
              <ReferenceLine
                segment={[{ x: 25, y: 75 }, { x: 25, y: 75 }]}
                label={{
                  value: 'Enthusiasts',
                  position: 'center',
                  fill: QUADRANT_CONFIG.enthusiast.color,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              />
              <ReferenceLine
                segment={[{ x: 75, y: 75 }, { x: 75, y: 75 }]}
                label={{
                  value: 'Stars',
                  position: 'center',
                  fill: QUADRANT_CONFIG.star.color,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              />
              <ReferenceLine
                segment={[{ x: 25, y: 25 }, { x: 25, y: 25 }]}
                label={{
                  value: 'Needs Attention',
                  position: 'center',
                  fill: QUADRANT_CONFIG.dead_wood.color,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              />
              <ReferenceLine
                segment={[{ x: 75, y: 25 }, { x: 75, y: 25 }]}
                label={{
                  value: 'Cynics',
                  position: 'center',
                  fill: QUADRANT_CONFIG.cynic.color,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Scatter
                name='Members'
                data={chartData}
                onClick={(data) => onMemberClick?.(data as unknown as MatrixMember)}
                cursor='pointer'
              >
                {chartData.map((member, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={QUADRANT_CONFIG[member.category].color}
                    opacity={hoveredMember === member.id ? 1 : 0.8}
                    onMouseEnter={() => setHoveredMember(member.id)}
                    onMouseLeave={() => setHoveredMember(null)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
