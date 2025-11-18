import { formatDate } from 'date-fns'
import { LeaderboardEntry } from '@/types/award'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  showCycleDetails?: boolean
}

export function LeaderboardTable({
  entries,
  showCycleDetails = false,
}: LeaderboardTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Rank</TableHead>
            <TableHead>Member</TableHead>
            <TableHead className="text-center">Total Wins</TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span>1st</span>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Medal className="h-4 w-4 text-gray-400" />
                <span>2nd</span>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Award className="h-4 w-4 text-orange-600" />
                <span>3rd</span>
              </div>
            </TableHead>
            <TableHead>Latest Win</TableHead>
            {showCycleDetails && <TableHead>Cycles Won</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showCycleDetails ? 8 : 7} className="text-center text-muted-foreground">
                No winners yet
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry, index) => {
              const initials = entry.member_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()

              return (
                <TableRow key={entry.member_id}>
                  {/* Rank */}
                  <TableCell className="font-bold">
                    <div className="flex items-center justify-center">
                      {index === 0 && (
                        <Trophy className="h-5 w-5 text-yellow-500" />
                      )}
                      {index === 1 && (
                        <Medal className="h-5 w-5 text-gray-400" />
                      )}
                      {index === 2 && (
                        <Award className="h-5 w-5 text-orange-600" />
                      )}
                      {index > 2 && <span>{index + 1}</span>}
                    </div>
                  </TableCell>

                  {/* Member */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.member_name}</span>
                    </div>
                  </TableCell>

                  {/* Total Wins */}
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-bold">
                      {entry.total_wins}
                    </Badge>
                  </TableCell>

                  {/* 1st Place Count */}
                  <TableCell className="text-center">
                    <span className="text-lg font-semibold">
                      {entry.first_place_count}
                    </span>
                  </TableCell>

                  {/* 2nd Place Count */}
                  <TableCell className="text-center">
                    <span className="text-lg font-semibold">
                      {entry.second_place_count}
                    </span>
                  </TableCell>

                  {/* 3rd Place Count */}
                  <TableCell className="text-center">
                    <span className="text-lg font-semibold">
                      {entry.third_place_count}
                    </span>
                  </TableCell>

                  {/* Latest Win Date */}
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(new Date(entry.latest_win_date), 'MMM dd, yyyy')}
                    </span>
                  </TableCell>

                  {/* Cycles Won */}
                  {showCycleDetails && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entry.cycles_won.slice(0, 3).map((cycle, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {cycle}
                          </Badge>
                        ))}
                        {entry.cycles_won.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{entry.cycles_won.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
