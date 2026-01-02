'use client'

/**
 * Commitment Card Form Component
 *
 * Digital commitment card for EC Chairs at Pathfinder.
 * Captures 3 commitments and optional digital signature.
 */

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Loader2,
  Heart,
  CheckCircle2,
  PenTool,
  Trash2,
  FileSignature,
} from 'lucide-react'
import { signCommitmentCard } from '@/app/actions/aaa'
import {
  signCommitmentCardSchema,
  type SignCommitmentCardInput,
} from '@/lib/validations/aaa'
import type { CommitmentCard } from '@/types/aaa'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface CommitmentCardFormProps {
  memberId: string
  memberName: string
  chapterId: string
  pathfinderYear: number
  aaaPlanId?: string
  existingCard?: CommitmentCard
}

export function CommitmentCardForm({
  memberId,
  memberName,
  chapterId,
  pathfinderYear,
  aaaPlanId,
  existingCard,
}: CommitmentCardFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [signatureData, setSignatureData] = useState<string>(existingCard?.signature_data || '')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  const isSigned = !!existingCard?.signed_at

  const form = useForm<SignCommitmentCardInput>({
    resolver: zodResolver(signCommitmentCardSchema),
    defaultValues: {
      member_id: memberId,
      chapter_id: chapterId,
      pathfinder_year: pathfinderYear,
      aaa_plan_id: aaaPlanId,
      commitment_1: existingCard?.commitment_1 || '',
      commitment_2: existingCard?.commitment_2 || '',
      commitment_3: existingCard?.commitment_3 || '',
      signature_data: existingCard?.signature_data || '',
    },
  })

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      const data = canvas.toDataURL('image/png')
      setSignatureData(data)
      form.setValue('signature_data', data)
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    setSignatureData('')
    form.setValue('signature_data', '')
  }

  const onSubmit = (data: SignCommitmentCardInput) => {
    startTransition(async () => {
      try {
        const result = await signCommitmentCard({
          ...data,
          signature_data: signatureData,
        })
        if (result.success) {
          toast.success(
            <div className="flex flex-col">
              <span className="font-semibold">Commitment Card Signed!</span>
              <span className="text-sm">Your commitments have been recorded.</span>
            </div>
          )
          router.push('/pathfinder')
          router.refresh()
        } else {
          toast.error(result.error || 'Failed to sign commitment card')
        }
      } catch (error) {
        console.error('Error:', error)
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <FileSignature className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Commitment Card</CardTitle>
            <CardDescription className="text-lg">
              Pathfinder {pathfinderYear}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-lg font-semibold text-primary">{memberName}</p>
            <p className="text-muted-foreground">EC Chair</p>
            {isSigned && existingCard?.signed_at && (
              <Badge variant="default" className="mt-4 bg-green-600">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Signed on {new Date(existingCard.signed_at).toLocaleDateString()}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Commitments Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <CardTitle>My Commitments</CardTitle>
            </div>
            <CardDescription>
              Make 3 personal commitments for this Pathfinder year
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Commitment 1 - Required */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-500">1</Badge>
                <span className="font-medium">First Commitment *</span>
              </div>
              <FormField
                control={form.control}
                name="commitment_1"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="I commit to..."
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Commitment 2 - Optional */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-red-500 text-red-600">2</Badge>
                <span className="font-medium">Second Commitment</span>
                <span className="text-sm text-muted-foreground">(Optional)</span>
              </div>
              <FormField
                control={form.control}
                name="commitment_2"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="I commit to..."
                        className="min-h-[100px] resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Commitment 3 - Optional */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-red-500 text-red-600">3</Badge>
                <span className="font-medium">Third Commitment</span>
                <span className="text-sm text-muted-foreground">(Optional)</span>
              </div>
              <FormField
                control={form.control}
                name="commitment_3"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="I commit to..."
                        className="min-h-[100px] resize-none"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Signature Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="h-5 w-5 text-primary" />
                <CardTitle>Digital Signature</CardTitle>
              </div>
              {signatureData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
            <CardDescription>
              Sign your commitment card below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-2 bg-muted/30">
              {existingCard?.signature_data && !signatureData ? (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={existingCard.signature_data}
                    alt="Existing signature"
                    className="max-h-32"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearSignature}
                  >
                    Draw New Signature
                  </Button>
                </div>
              ) : signatureData ? (
                <img
                  src={signatureData}
                  alt="Your signature"
                  className="max-h-32 mx-auto"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full h-[150px] cursor-crosshair bg-white rounded touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2">
              {signatureData ? 'Signature captured' : 'Draw your signature above'}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800 text-sm">
                By signing, I affirm my commitment to these goals for Pathfinder {pathfinderYear}.
              </AlertDescription>
            </Alert>
          </CardFooter>
        </Card>

        {/* Hidden fields */}
        <input type="hidden" {...form.register('member_id')} />
        <input type="hidden" {...form.register('chapter_id')} />
        <input type="hidden" {...form.register('pathfinder_year')} />

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} size="lg">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSigned ? 'Update Commitment' : 'Sign Commitment Card'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
