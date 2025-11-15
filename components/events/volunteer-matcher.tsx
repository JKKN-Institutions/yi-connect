'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, Star, Clock, Award, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { VolunteerMatch } from '@/types/event';

interface VolunteerMatcherProps {
  eventId: string;
  requiredSkills?: string[];
  onSelectVolunteer?: (volunteerId: string, volunteerName: string) => void;
}

export function VolunteerMatcher({
  eventId,
  requiredSkills = [],
  onSelectVolunteer
}: VolunteerMatcherProps) {
  const [matches, setMatches] = useState<VolunteerMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'match_score' | 'volunteer_hours' | 'events_volunteered'>('match_score');
  const [minAvailability, setMinAvailability] = useState<'available' | 'busy' | 'unavailable'>('available');

  useEffect(() => {
    fetchMatches();
  }, [eventId, requiredSkills, sortBy, minAvailability]);

  const fetchMatches = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/volunteer-matches?` + new URLSearchParams({
        required_skills: requiredSkills.join(','),
        sort_by: sortBy,
        min_availability: minAvailability
      }));

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Error fetching volunteer matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMatches = matches.filter((match) =>
    match.member_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getAvailabilityBadge = (status: string): 'default' | 'secondary' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      available: 'default',
      busy: 'secondary',
      unavailable: 'outline'
    };
    return variants[status] || 'outline';
  };

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold'>Smart Volunteer Matching</h3>
          <p className='text-sm text-muted-foreground'>
            AI-powered recommendations based on skills and experience
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={fetchMatches}>
          <TrendingUp className='mr-2 h-4 w-4' />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className='flex gap-2'>
        <div className='flex-1'>
          <Input
            placeholder='Search volunteers...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full'
          />
        </div>
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Sort by' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='match_score'>Match Score</SelectItem>
            <SelectItem value='volunteer_hours'>Hours</SelectItem>
            <SelectItem value='events_volunteered'>Events</SelectItem>
          </SelectContent>
        </Select>
        <Select value={minAvailability} onValueChange={(value: any) => setMinAvailability(value)}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Availability' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='available'>Available</SelectItem>
            <SelectItem value='busy'>Available & Busy</SelectItem>
            <SelectItem value='unavailable'>All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Required Skills */}
      {requiredSkills.length > 0 && (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-sm font-medium'>Required Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-2'>
              {requiredSkills.map((skill) => (
                <Badge key={skill} variant='secondary'>
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volunteer List */}
      {isLoading ? (
        <VolunteerMatcherSkeleton />
      ) : filteredMatches.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12'>
            <Search className='h-12 w-12 text-muted-foreground mb-4' />
            <h3 className='text-lg font-semibold mb-2'>No matches found</h3>
            <p className='text-muted-foreground text-center'>
              {searchQuery
                ? 'Try adjusting your search query'
                : 'No volunteers match the current criteria'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {filteredMatches.map((match) => (
            <Card
              key={match.member_id}
              className='hover:shadow-md transition-shadow'
            >
              <CardContent className='p-4'>
                <div className='flex items-start justify-between gap-4'>
                  {/* Volunteer Info */}
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-2'>
                      <h4 className='font-semibold'>{match.member_name}</h4>
                      <Badge variant={getAvailabilityBadge(match.availability_status)}>
                        {match.availability_status}
                      </Badge>
                    </div>

                    {/* Matching Skills */}
                    {match.matching_skills.length > 0 && (
                      <div className='flex flex-wrap gap-1 mb-2'>
                        {match.matching_skills.map((skill) => (
                          <Badge key={skill} variant='outline' className='text-xs'>
                            <Award className='mr-1 h-3 w-3' />
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                      <div className='flex items-center gap-1'>
                        <Clock className='h-4 w-4' />
                        <span>{match.volunteer_hours} hours</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <Star className='h-4 w-4' />
                        <span>{match.events_volunteered} events</span>
                      </div>
                    </div>
                  </div>

                  {/* Match Score & Action */}
                  <div className='flex flex-col items-end gap-2'>
                    <div
                      className={cn(
                        'px-3 py-1 rounded-full border font-semibold text-sm',
                        getMatchScoreColor(match.match_score)
                      )}
                    >
                      {match.match_score}% Match
                    </div>
                    {onSelectVolunteer && (
                      <Button
                        size='sm'
                        onClick={() => onSelectVolunteer(match.member_id, match.member_name)}
                      >
                        <UserPlus className='mr-2 h-4 w-4' />
                        Assign
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Summary */}
      {!isLoading && filteredMatches.length > 0 && (
        <div className='text-sm text-muted-foreground text-center'>
          Showing {filteredMatches.length} of {matches.length} volunteers
        </div>
      )}
    </div>
  );
}

function VolunteerMatcherSkeleton() {
  return (
    <div className='space-y-3'>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className='p-4'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-5 w-32' />
                <div className='flex gap-1'>
                  <Skeleton className='h-5 w-16' />
                  <Skeleton className='h-5 w-16' />
                </div>
                <div className='flex gap-4'>
                  <Skeleton className='h-4 w-20' />
                  <Skeleton className='h-4 w-20' />
                </div>
              </div>
              <div className='flex flex-col gap-2 items-end'>
                <Skeleton className='h-6 w-24' />
                <Skeleton className='h-9 w-24' />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
