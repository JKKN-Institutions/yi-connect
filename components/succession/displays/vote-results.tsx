'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ThumbsUp, ThumbsDown, Minus, Trophy } from 'lucide-react'
import { VoteBadge } from './succession-status-badges'

interface VoteResult {
  position: {
    id: string
    title: string
    hierarchy_level: number
  }
  nominee: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  }
  votes: {
    yes: number
    no: number
    abstain: number
  }
}

interface VoteResultsProps {
  results: VoteResult[]
  totalVoters: number
}

export function VoteResults({ results, totalVoters }: VoteResultsProps) {
  // Group results by position
  const resultsByPosition = results.reduce((acc, result) => {
    const key = result.position.id
    if (!acc[key]) {
      acc[key] = {
        position: result.position,
        nominees: [],
      }
    }
    acc[key].nominees.push(result)
    return acc
  }, {} as Record<string, { position: any; nominees: VoteResult[] }>)

  // Sort nominees within each position by yes votes (descending)
  Object.values(resultsByPosition).forEach((positionData) => {
    positionData.nominees.sort((a, b) => b.votes.yes - a.votes.yes)
  })

  const getVotePercentage = (count: number) => {
    if (totalVoters === 0) return 0
    return Math.round((count / totalVoters) * 100)
  }

  const getWinner = (nominees: VoteResult[]) => {
    if (nominees.length === 0) return null
    const sorted = [...nominees].sort((a, b) => b.votes.yes - a.votes.yes)
    return sorted[0]
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No Votes Cast Yet</p>
            <p className="text-sm mt-2">Vote results will appear here after voting</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(resultsByPosition).map(([positionId, positionData]) => {
        const winner = getWinner(positionData.nominees)

        return (
          <Card key={positionId}>
            <CardHeader>
              <CardTitle>{positionData.position.title}</CardTitle>
              <CardDescription>
                Level {positionData.position.hierarchy_level} • {totalVoters} Total Voters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {positionData.nominees.map((result, index) => {
                const isWinner = winner && result.nominee.id === winner.nominee.id
                const totalVotes = result.votes.yes + result.votes.no + result.votes.abstain
                const yesPercentage = getVotePercentage(result.votes.yes)
                const noPercentage = getVotePercentage(result.votes.no)
                const abstainPercentage = getVotePercentage(result.votes.abstain)

                return (
                  <Card
                    key={result.nominee.id}
                    className={`border-2 ${
                      isWinner ? 'border-green-500 bg-green-50' : ''
                    }`}
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isWinner && <Trophy className="h-5 w-5 text-green-600" />}
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={result.nominee.avatar_url} />
                              <AvatarFallback>
                                {result.nominee.first_name[0]}
                                {result.nominee.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="font-semibold">
                                {result.nominee.first_name} {result.nominee.last_name}
                              </h4>
                              {isWinner && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Leading Candidate
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              {result.votes.yes}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Yes votes
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span>Yes</span>
                              </div>
                              <span className="font-medium">
                                {result.votes.yes} ({yesPercentage}%)
                              </span>
                            </div>
                            <Progress value={yesPercentage} className="h-2 bg-green-100" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <ThumbsDown className="h-4 w-4 text-red-600" />
                                <span>No</span>
                              </div>
                              <span className="font-medium">
                                {result.votes.no} ({noPercentage}%)
                              </span>
                            </div>
                            <Progress value={noPercentage} className="h-2 bg-red-100" />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <Minus className="h-4 w-4 text-gray-600" />
                                <span>Abstain</span>
                              </div>
                              <span className="font-medium">
                                {result.votes.abstain} ({abstainPercentage}%)
                              </span>
                            </div>
                            <Progress value={abstainPercentage} className="h-2 bg-gray-100" />
                          </div>
                        </div>

                        {totalVotes < totalVoters && (
                          <div className="text-xs text-muted-foreground">
                            {totalVoters - totalVotes} voter(s) pending
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Compact version for displaying in tables
interface CompactVoteResultProps {
  yes: number
  no: number
  abstain: number
  totalVoters: number
}

export function CompactVoteResult({
  yes,
  no,
  abstain,
  totalVoters,
}: CompactVoteResultProps) {
  const total = yes + no + abstain
  const pending = totalVoters - total

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <ThumbsUp className="h-3 w-3 text-green-600" />
        <span className="text-sm font-medium">{yes}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsDown className="h-3 w-3 text-red-600" />
        <span className="text-sm font-medium">{no}</span>
      </div>
      <div className="flex items-center gap-1">
        <Minus className="h-3 w-3 text-gray-600" />
        <span className="text-sm font-medium">{abstain}</span>
      </div>
      {pending > 0 && (
        <Badge variant="outline" className="text-xs">
          {pending} pending
        </Badge>
      )}
    </div>
  )
}
