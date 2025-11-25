/**
 * Bulk Upload Wizard Component
 *
 * Orchestrates the multi-step bulk member upload process.
 * Steps: Upload → Preview → Options → Process → Summary
 */

'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Upload,
  FileSearch,
  Settings,
  PlayCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BulkUploadDropzone,
  BulkUploadPreview,
  BulkUploadProgress,
  BulkUploadOptionsPanel,
  BulkUploadSummary
} from '@/components/members'
import { parseExcelFile, type ParseResult } from '@/lib/utils/excel-parser'
import { processBulkMemberUpload } from '@/app/actions/bulk-members'
import type {
  BulkUploadOptions,
  BulkUploadResult,
  BulkUploadRowResult
} from '@/lib/validations/bulk-member'
import type { ChapterOption } from '@/types/chapter'

type WizardStep = 'upload' | 'preview' | 'options' | 'processing' | 'summary'

interface BulkUploadWizardProps {
  chapters: ChapterOption[]
}

const STEPS: Array<{ id: WizardStep; label: string; icon: React.ElementType }> = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'preview', label: 'Preview', icon: FileSearch },
  { id: 'options', label: 'Options', icon: Settings },
  { id: 'processing', label: 'Processing', icon: PlayCircle },
  { id: 'summary', label: 'Summary', icon: CheckCircle2 }
]

export function BulkUploadWizard({ chapters }: BulkUploadWizardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  // Upload options
  const [uploadOptions, setUploadOptions] = useState<BulkUploadOptions>({
    skipExisting: true,
    updateExisting: false,
    sendWelcomeEmail: false,
    defaultChapterId: chapters[0]?.id,
    defaultMembershipStatus: 'active'
  })

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [processedRows, setProcessedRows] = useState(0)
  const [currentResults, setCurrentResults] = useState<BulkUploadRowResult[]>([])
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null)
  const [startTime, setStartTime] = useState<Date | undefined>()

  // Confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    setParseError(null)
    setIsParsing(true)

    try {
      // Read file as ArrayBuffer
      const buffer = await file.arrayBuffer()
      const result = parseExcelFile(buffer)

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse file')
      }

      setParseResult(result)
      setCurrentStep('preview')
    } catch (error) {
      console.error('Error parsing file:', error)
      setParseError(error instanceof Error ? error.message : 'Failed to parse file')
      setSelectedFile(null)
    } finally {
      setIsParsing(false)
    }
  }, [])

  // Clear file and reset
  const handleClearFile = useCallback(() => {
    setSelectedFile(null)
    setParseResult(null)
    setParseError(null)
    setCurrentStep('upload')
  }, [])

  // Reset entire wizard
  const handleReset = useCallback(() => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setParseResult(null)
    setParseError(null)
    setUploadOptions({
      skipExisting: true,
      updateExisting: false,
      sendWelcomeEmail: false,
      defaultChapterId: chapters[0]?.id,
      defaultMembershipStatus: 'active'
    })
    setIsProcessing(false)
    setProcessedRows(0)
    setCurrentResults([])
    setUploadResult(null)
    setStartTime(undefined)
  }, [chapters])

  // Start processing
  const handleStartProcessing = useCallback(async () => {
    if (!parseResult) return

    setShowConfirmDialog(false)
    setCurrentStep('processing')
    setIsProcessing(true)
    setProcessedRows(0)
    setCurrentResults([])
    setStartTime(new Date())

    // Filter only valid rows
    const validRows = parseResult.data
      .filter(row => row.isValid)
      .map(row => ({
        rowNumber: row.rowNumber,
        data: row.data
      }))

    // Process in batches for progress updates
    const BATCH_SIZE = 10
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE)
    const allResults: BulkUploadRowResult[] = []

    for (let i = 0; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE
      const batchEnd = Math.min(batchStart + BATCH_SIZE, validRows.length)
      const batch = validRows.slice(batchStart, batchEnd)

      try {
        const result = await processBulkMemberUpload(batch, uploadOptions)

        allResults.push(...result.results)
        setCurrentResults([...allResults])
        setProcessedRows(batchEnd)

        // Small delay between batches to show progress
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error('Batch processing error:', error)
        // Add error results for this batch
        batch.forEach(row => {
          allResults.push({
            rowNumber: row.rowNumber,
            status: 'error',
            email: row.data.email || 'Unknown',
            fullName: row.data.full_name || 'Unknown',
            message: 'Processing failed - server error'
          })
        })
        setCurrentResults([...allResults])
        setProcessedRows(batchEnd)
      }
    }

    // Calculate final result
    const finalResult: BulkUploadResult = {
      success: allResults.some(r => r.status === 'success' || r.status === 'updated'),
      totalProcessed: allResults.length,
      successCount: allResults.filter(r => r.status === 'success').length,
      skippedCount: allResults.filter(r => r.status === 'skipped').length,
      errorCount: allResults.filter(r => r.status === 'error').length,
      updatedCount: allResults.filter(r => r.status === 'updated').length,
      results: allResults,
      errors: []
    }

    setUploadResult(finalResult)
    setIsProcessing(false)
    setCurrentStep('summary')
  }, [parseResult, uploadOptions])

  // Navigate between steps
  const canGoBack = currentStep === 'preview' || currentStep === 'options'
  const canProceed =
    (currentStep === 'preview' && parseResult && parseResult.validRows > 0) ||
    (currentStep === 'options' && uploadOptions.defaultChapterId)

  const handleBack = () => {
    if (currentStep === 'preview') {
      handleClearFile()
    } else if (currentStep === 'options') {
      setCurrentStep('preview')
    }
  }

  const handleNext = () => {
    if (currentStep === 'preview') {
      setCurrentStep('options')
    } else if (currentStep === 'options') {
      setShowConfirmDialog(true)
    }
  }

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/members">Members</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Bulk Upload</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Member Upload</h1>
        <p className="text-muted-foreground mt-1">
          Upload multiple members at once from an Excel file
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isActive = step.id === currentStep
          const isCompleted = idx < currentStepIndex
          const isClickable = isCompleted && !isProcessing

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => isClickable && setCurrentStep(step.id)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && !isActive && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                  isClickable && 'cursor-pointer hover:opacity-80'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium hidden sm:inline">{step.label}</span>
                {isCompleted && <CheckCircle2 className="h-4 w-4 ml-1" />}
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-2',
                    idx < currentStepIndex ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      {currentStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
            <CardDescription>
              Select an Excel file containing member data to upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BulkUploadDropzone
              onFileSelect={handleFileSelect}
              isProcessing={isParsing}
              selectedFile={selectedFile}
              onClearFile={handleClearFile}
            />
            {parseError && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">{parseError}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === 'preview' && parseResult && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview Data</CardTitle>
                  <CardDescription>
                    Review the parsed data before uploading
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    {parseResult.validRows} valid
                  </Badge>
                  {parseResult.invalidRows > 0 && (
                    <Badge variant="destructive">
                      {parseResult.invalidRows} errors
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <BulkUploadPreview parseResult={parseResult} />
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 'options' && (
        <div className="space-y-4">
          <BulkUploadOptionsPanel
            options={uploadOptions}
            onOptionsChange={setUploadOptions}
            chapters={chapters}
          />

          {/* Summary of what will be uploaded */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Valid records to upload:</span>
                  <span className="ml-2 font-semibold text-green-600">
                    {parseResult?.validRows || 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Records with errors (skipped):</span>
                  <span className="ml-2 font-semibold text-destructive">
                    {parseResult?.invalidRows || 0}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Target chapter:</span>
                  <span className="ml-2 font-semibold">
                    {chapters.find(c => c.id === uploadOptions.defaultChapterId)?.name || 'Not selected'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Default status:</span>
                  <span className="ml-2 font-semibold capitalize">
                    {uploadOptions.defaultMembershipStatus}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 'processing' && parseResult && (
        <BulkUploadProgress
          totalRows={parseResult.validRows}
          processedRows={processedRows}
          currentResults={currentResults}
          isComplete={!isProcessing}
          startTime={startTime}
        />
      )}

      {currentStep === 'summary' && uploadResult && (
        <BulkUploadSummary result={uploadResult} onReset={handleReset} />
      )}

      {/* Navigation Buttons */}
      {(currentStep === 'preview' || currentStep === 'options') && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={!canGoBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <Button onClick={handleNext} disabled={!canProceed}>
            {currentStep === 'options' ? (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Start Upload
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Upload</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to upload {parseResult?.validRows || 0} members to the{' '}
              <strong>
                {chapters.find(c => c.id === uploadOptions.defaultChapterId)?.name}
              </strong>{' '}
              chapter.
              {uploadOptions.sendWelcomeEmail && (
                <>
                  <br />
                  <br />
                  Welcome emails will be sent to each new member.
                </>
              )}
              <br />
              <br />
              This action cannot be undone. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartProcessing}>
              Yes, Start Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
