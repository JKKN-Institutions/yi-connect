import { formatDate } from 'date-fns';
import { AwardWinnerWithDetails } from '@/types/award';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Star } from 'lucide-react';

interface WinnerAnnouncementProps {
  winners: AwardWinnerWithDetails[];
  cycleTitle?: string;
  categoryName?: string;
}

const RANK_CONFIG = {
  1: {
    icon: Trophy,
    label: '1st Place',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-200 dark:border-yellow-800'
  },
  2: {
    icon: Medal,
    label: '2nd Place',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    borderColor: 'border-gray-200 dark:border-gray-800'
  },
  3: {
    icon: Award,
    label: '3rd Place',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    borderColor: 'border-orange-200 dark:border-orange-800'
  }
} as const;

export function WinnerAnnouncement({
  winners,
  cycleTitle,
  categoryName
}: WinnerAnnouncementProps) {
  // Sort winners by rank
  const sortedWinners = [...winners].sort((a, b) => a.rank - b.rank);

  return (
    <div className='space-y-6'>
      {/* Header */}
      {(cycleTitle || categoryName) && (
        <div className='text-center space-y-2'>
          <div className='flex items-center justify-center gap-2'>
            <Star className='h-8 w-8 text-yellow-500 fill-yellow-500' />
            <h2 className='text-3xl font-bold'>Winners Announced!</h2>
            <Star className='h-8 w-8 text-yellow-500 fill-yellow-500' />
          </div>
          {categoryName && (
            <p className='text-xl text-muted-foreground'>{categoryName}</p>
          )}
          {cycleTitle && (
            <p className='text-lg text-muted-foreground'>{cycleTitle}</p>
          )}
        </div>
      )}

      {/* Winners Grid */}
      <div className='grid gap-6 md:grid-cols-1 lg:grid-cols-3'>
        {sortedWinners.map((winner) => {
          const rankConfig = RANK_CONFIG[winner.rank as 1 | 2 | 3];
          const RankIcon = rankConfig.icon;
          const nominee = winner.nomination?.nominee;

          const initials = nominee?.full_name
            ? nominee.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
            : '??';

          return (
            <Card
              key={winner.id}
              className={`${rankConfig.borderColor} border-2 ${rankConfig.bgColor} hover:shadow-xl transition-shadow`}
            >
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <Badge
                    variant='outline'
                    className={`${rankConfig.color} font-bold`}
                  >
                    <RankIcon className='mr-1 h-4 w-4' />
                    {rankConfig.label}
                  </Badge>
                  <div className='text-right'>
                    <div className='text-2xl font-bold'>
                      {winner.final_score?.toFixed(2) ?? 'N/A'}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Final Score
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className='space-y-4'>
                {/* Winner Avatar & Name */}
                <div className='flex flex-col items-center text-center space-y-3'>
                  <Avatar className='h-24 w-24'>
                    {nominee?.avatar_url && (
                      <AvatarImage
                        src={nominee.avatar_url}
                        alt={nominee.full_name}
                      />
                    )}
                    <AvatarFallback className='text-2xl'>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className='text-xl'>
                      {nominee?.full_name || 'Unknown'}
                    </CardTitle>
                    {nominee?.designation && nominee?.company && (
                      <CardDescription className='mt-1'>
                        {nominee.designation} at {nominee.company}
                      </CardDescription>
                    )}
                  </div>
                </div>

                {/* Justification Preview */}
                {winner.nomination?.justification && (
                  <div className='pt-4 border-t'>
                    <p className='text-sm text-muted-foreground line-clamp-3'>
                      {winner.nomination.justification}
                    </p>
                  </div>
                )}

                {/* Announcement Details */}
                {winner.announced_at && (
                  <div className='pt-4 border-t text-center'>
                    <p className='text-xs text-muted-foreground'>
                      Announced on{' '}
                      {formatDate(
                        new Date(winner.announced_at),
                        'MMMM dd, yyyy'
                      )}
                    </p>
                    {winner.announced_by_member && (
                      <p className='text-xs text-muted-foreground'>
                        by {winner.announced_by_member.full_name}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No Winners Message */}
      {winners.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
            <Trophy className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              Winners will be announced soon
            </p>
            <p className='text-sm text-muted-foreground mt-2'>
              Check back later for the results
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
