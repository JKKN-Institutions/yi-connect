'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { submitVote } from '@/app/actions/succession'
import { CreateVoteSchema } from '@/lib/validations/succession'
import { toast } from 'react-hot-toast'

type VoteFormData = Omit<z.infer<typeof CreateVoteSchema>, 'voter_member_id'>

interface VotingBallotProps {
  meetingId: string
  nominees: Array<{
    id: string
    position_id: string
    position_title: string
    position_level: number
    nominee_id: string
    nominee_name: string
    nominee_email: string
    nominee_avatar?: string
    nomination_reason?: string
    evaluation_score?: number
    existing_vote?: {
      id: string
      vote: 'yes' | 'no' | 'abstain'
      comments?: string
    }
  }>
}

export function VotingBallot({ meetingId, nominees }: VotingBallotProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [votes, setVotes] = useState<
    Record<string, { vote: 'yes' | 'no' | 'abstain'; comments: string }>
  >({})

  // Initialize with existing votes if any
  useState(() => {
    const initialVotes: Record<string, { vote: 'yes' | 'no' | 'abstain'; comments: string }> = {}
    nominees.forEach((nominee) => {
      if (nominee.existing_vote) {
        initialVotes[nominee.id] = {
          vote: nominee.existing_vote.vote,
          comments: nominee.existing_vote.comments || '',
        }
      }
    })
    setVotes(initialVotes)
  })

  const handleVoteChange = (nomineeId: string, vote: 'yes' | 'no' | 'abstain') => {
    setVotes((prev) => ({
      ...prev,
      [nomineeId]: {
        vote,
        comments: prev[nomineeId]?.comments || '',
      },
    }))
  }

  const handleCommentsChange = (nomineeId: string, comments: string) => {
    setVotes((prev) => ({
      ...prev,
      [nomineeId]: {
        vote: prev[nomineeId]?.vote || 'abstain',
        comments,
      },
    }))
  }

  const handleSubmitAll = async () => {
    // Check if all nominees have been voted on
    const unvotedNominees = nominees.filter((n) => !votes[n.id])
    if (unvotedNominees.length > 0) {
      toast.error(
        `Please cast your vote for all nominees (${unvotedNominees.length} remaining)`
      )
      return
    }

    setIsSubmitting(true)

    // Submit votes one by one
    const results = await Promise.all(
      Object.entries(votes).map(async ([nomineeId, voteData]) => {
        const nominee = nominees.find((n) => n.id === nomineeId)
        if (!nominee) return { success: false }

        const formData = new FormData()
        formData.append('meeting_id', meetingId)
        formData.append('position_id', nominee.position_id)
        formData.append('nominee_id', nominee.nominee_id)
        formData.append('vote', voteData.vote)
        if (voteData.comments) formData.append('comments', voteData.comments)

        return await submitVote(formData)
      })
    )

    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    if (failCount === 0) {
      toast.success('All votes submitted successfully')
      router.refresh()
    } else if (successCount > 0) {
      toast.success(
        `${successCount} votes submitted successfully, ${failCount} failed`
      )
      router.refresh()
    } else {
      toast.error('Failed to submit votes')
    }

    setIsSubmitting(false)
  }

  const getVoteIcon = (vote: 'yes' | 'no' | 'abstain') => {
    switch (vote) {
      case 'yes':
        return <ThumbsUp className="h-4 w-4" />
      case 'no':
        return <ThumbsDown className="h-4 w-4" />
      case 'abstain':
        return <Minus className="h-4 w-4" />
    }
  }

  // Group nominees by position
  const nomineesByPosition = nominees.reduce((acc, nominee) => {
    const key = `${nominee.position_id}`
    if (!acc[key]) {
      acc[key] = {
        position_title: nominee.position_title,
        position_level: nominee.position_level,
        nominees: [],
      }
    }
    acc[key].nominees.push(nominee)
    return acc
  }, {} as Record<string, { position_title: string; position_level: number; nominees: any[] }>)

  if (nominees.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No Nominees to Vote On</p>
            <p className="text-sm mt-2">
              Nominees will appear here when they are assigned to this meeting
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(nomineesByPosition).map(([positionId, positionData]) => (
        <Card key={positionId}>
          <CardHeader>
            <CardTitle>{positionData.position_title}</CardTitle>
            <CardDescription>
              Level {positionData.position_level} • {positionData.nominees.length}{' '}
              {positionData.nominees.length === 1 ? 'Nominee' : 'Nominees'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {positionData.nominees.map((nominee) => (
              <Card key={nominee.id} className="border-2">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={nominee.nominee_avatar} />
                          <AvatarFallback>
                            {nominee.nominee_name
                              .split(' ')
                              .map((n: string) => n[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="text-lg font-semibold">{nominee.nominee_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {nominee.nominee_email}
                          </p>
                        </div>
                      </div>
                      {nominee.evaluation_score !== undefined && (
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          Score: {nominee.evaluation_score.toFixed(1)}%
                        </Badge>
                      )}
                    </div>

                    {nominee.nomination_reason && (
                      <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm font-medium mb-1">Nomination Reason:</p>
                        <p className="text-sm text-muted-foreground">
                          {nominee.nomination_reason}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <Label>Your Vote</Label>
                      <RadioGroup
                        value={votes[nominee.id]?.vote}
                        onValueChange={(value: any) => handleVoteChange(nominee.id, value)}
                        className="grid grid-cols-3 gap-4"
                      >
                        <div>
                          <RadioGroupItem value="yes" id={`${nominee.id}-yes`} className="peer sr-only" />
                          <Label
                            htmlFor={`${nominee.id}-yes`}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-green-600 peer-data-[state=checked]:bg-green-50 cursor-pointer"
                          >
                            <ThumbsUp className="mb-2 h-6 w-6 text-green-600" />
                            <span className="font-semibold">Yes</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            value="abstain"
                            id={`${nominee.id}-abstain`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`${nominee.id}-abstain`}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-gray-600 peer-data-[state=checked]:bg-gray-50 cursor-pointer"
                          >
                            <Minus className="mb-2 h-6 w-6 text-gray-600" />
                            <span className="font-semibold">Abstain</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem value="no" id={`${nominee.id}-no`} className="peer sr-only" />
                          <Label
                            htmlFor={`${nominee.id}-no`}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50 cursor-pointer"
                          >
                            <ThumbsDown className="mb-2 h-6 w-6 text-red-600" />
                            <span className="font-semibold">No</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${nominee.id}-comments`}>
                        Comments (Optional)
                      </Label>
                      <Textarea
                        id={`${nominee.id}-comments`}
                        value={votes[nominee.id]?.comments || ''}
                        onChange={(e) => handleCommentsChange(nominee.id, e.target.value)}
                        placeholder="Share your rationale or feedback..."
                        className="min-h-[80px]"
                      />
                    </div>

                    {nominee.existing_vote && (
                      <Badge variant="outline" className="mt-2">
                        Previously voted: {nominee.existing_vote.vote.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-4 sticky bottom-4 bg-background p-4 border-t">
        <Button
          onClick={handleSubmitAll}
          disabled={isSubmitting || Object.keys(votes).length !== nominees.length}
          size="lg"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit All Votes ({Object.keys(votes).length}/{nominees.length})
        </Button>
      </div>
    </div>
  )
}
