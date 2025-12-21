'use client';

/**
 * Member List for Skill/Will Matrix
 *
 * Displays a filterable list of members with their skill/will scores.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { MatrixMember } from '@/lib/data/skill-will-matrix';
import { QUADRANT_CONFIG } from '@/lib/data/skill-will-matrix-config';
import type { SkillWillCategory } from '@/types/member';

interface MemberListProps {
  members: MatrixMember[];
  selectedCategory?: SkillWillCategory | null;
  onCategoryChange?: (category: SkillWillCategory | null) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

type SortField = 'name' | 'skill_score' | 'will_score' | 'category';
type SortDirection = 'asc' | 'desc';

export function MemberList({ members, selectedCategory, onCategoryChange }: MemberListProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('skill_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredMembers = members
    .filter((member) => {
      const matchesSearch =
        member.full_name.toLowerCase().includes(search.toLowerCase()) ||
        member.email.toLowerCase().includes(search.toLowerCase()) ||
        member.company?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = !selectedCategory || member.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.full_name.localeCompare(b.full_name);
          break;
        case 'skill_score':
          comparison = a.skill_score - b.skill_score;
          break;
        case 'will_score':
          comparison = a.will_score - b.will_score;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className='h-4 w-4 ml-1' />
    ) : (
      <ChevronDown className='h-4 w-4 ml-1' />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
          <div>
            <CardTitle>Member Details</CardTitle>
            <CardDescription>
              {filteredMembers.length} of {members.length} members
              {selectedCategory && ` in ${QUADRANT_CONFIG[selectedCategory].label}`}
            </CardDescription>
          </div>
          <div className='flex gap-2'>
            <Input
              placeholder='Search members...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-[200px]'
            />
            <Select
              value={selectedCategory || 'all'}
              onValueChange={(v) => onCategoryChange?.(v === 'all' ? null : v as SkillWillCategory)}
            >
              <SelectTrigger className='w-[160px]'>
                <SelectValue placeholder='All Categories' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Categories</SelectItem>
                <SelectItem value='star'>Stars</SelectItem>
                <SelectItem value='enthusiast'>Enthusiasts</SelectItem>
                <SelectItem value='cynic'>Cynics</SelectItem>
                <SelectItem value='dead_wood'>Needs Attention</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('name')}
                >
                  <div className='flex items-center'>
                    Member
                    <SortIcon field='name' />
                  </div>
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50 text-center'
                  onClick={() => handleSort('skill_score')}
                >
                  <div className='flex items-center justify-center'>
                    Skill
                    <SortIcon field='skill_score' />
                  </div>
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50 text-center'
                  onClick={() => handleSort('will_score')}
                >
                  <div className='flex items-center justify-center'>
                    Will
                    <SortIcon field='will_score' />
                  </div>
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('category')}
                >
                  <div className='flex items-center'>
                    Category
                    <SortIcon field='category' />
                  </div>
                </TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const config = QUADRANT_CONFIG[member.category];
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className='flex items-center gap-3'>
                        <Avatar className='h-9 w-9'>
                          <AvatarImage src={member.avatar_url || undefined} alt={member.full_name} />
                          <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className='font-medium'>{member.full_name}</p>
                          <p className='text-xs text-muted-foreground'>
                            {member.designation || 'Member'}
                            {member.company && ` at ${member.company}`}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-center'>
                      <div className='flex flex-col items-center'>
                        <span className='text-lg font-bold'>{member.skill_score}</span>
                        {member.top_skill && (
                          <span className='text-xs text-muted-foreground truncate max-w-[100px]'>
                            {member.top_skill}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-center'>
                      <div className='flex flex-col items-center'>
                        <span className='text-lg font-bold'>{member.will_score}</span>
                        {member.engagement_score && (
                          <span className='text-xs text-muted-foreground'>
                            Engagement: {member.engagement_score}%
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='secondary'
                        className={cn('font-medium')}
                        style={{
                          backgroundColor: `${config.color}20`,
                          color: config.color,
                        }}
                      >
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button variant='ghost' size='sm' asChild>
                        <Link href={`/members/${member.id}`}>
                          <ExternalLink className='h-4 w-4 mr-1' />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className='text-center py-8 text-muted-foreground'>
                    No members found matching your criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
