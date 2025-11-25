/**
 * Bulk Upload Dropzone Component
 *
 * File upload dropzone for Excel files with drag and drop support.
 */

'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, X, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateTemplate } from '@/lib/utils/excel-parser'

interface BulkUploadDropzoneProps {
  onFileSelect: (file: File) => void
  isProcessing?: boolean
  selectedFile?: File | null
  onClearFile?: () => void
}

export function BulkUploadDropzone({
  onFileSelect,
  isProcessing = false,
  selectedFile,
  onClearFile
}: BulkUploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('File is too large. Maximum size is 10MB.')
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload an Excel file (.xlsx or .xls)')
        } else {
          setError('Invalid file. Please try again.')
        }
        return
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 1,
    disabled: isProcessing
  })

  const handleDownloadTemplate = () => {
    const buffer = generateTemplate()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'member_upload_template.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Template Download */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <h4 className="font-medium">Download Template</h4>
          <p className="text-sm text-muted-foreground">
            Use our template to ensure your data is formatted correctly
          </p>
        </div>
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
      </div>

      {/* Dropzone */}
      {!selectedFile ? (
        <Card
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed cursor-pointer transition-colors',
            isDragActive && !isDragReject && 'border-primary bg-primary/5',
            isDragReject && 'border-destructive bg-destructive/5',
            isProcessing && 'opacity-50 cursor-not-allowed',
            !isDragActive && !isDragReject && 'hover:border-primary/50'
          )}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <input {...getInputProps()} />

            <div
              className={cn(
                'rounded-full p-4 mb-4',
                isDragActive && !isDragReject && 'bg-primary/10',
                isDragReject && 'bg-destructive/10',
                !isDragActive && 'bg-muted'
              )}
            >
              {isDragReject ? (
                <AlertCircle className="h-8 w-8 text-destructive" />
              ) : (
                <Upload
                  className={cn(
                    'h-8 w-8',
                    isDragActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              )}
            </div>

            {isDragActive && !isDragReject ? (
              <p className="text-lg font-medium text-primary">Drop the file here</p>
            ) : isDragReject ? (
              <p className="text-lg font-medium text-destructive">Invalid file type</p>
            ) : (
              <>
                <p className="text-lg font-medium">
                  Drag and drop your Excel file here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </>
            )}

            <p className="text-xs text-muted-foreground mt-4">
              Supported formats: .xlsx, .xls (max 10MB)
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Selected File Display */
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
                <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {!isProcessing && onClearFile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onClearFile()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
