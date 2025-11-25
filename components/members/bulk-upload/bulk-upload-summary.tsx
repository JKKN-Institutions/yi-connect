/**
 * Bulk Upload Summary Component
 *
 * Displays final summary after bulk upload completion.
 */

'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Users,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { BulkUploadResult, BulkUploadRowResult } from '@/lib/validations/bulk-member'
import * as XLSX from 'xlsx'

interface BulkUploadSummaryProps {
  result: BulkUploadResult
  onReset: () => void
}

export function BulkUploadSummary({ result, onReset }: BulkUploadSummaryProps) {
  const successResults = result.results.filter(r => r.status === 'success')
  const updatedResults = result.results.filter(r => r.status === 'updated')
  const skippedResults = result.results.filter(r => r.status === 'skipped')
  const errorResults = result.results.filter(r => r.status === 'error')

  const downloadReport = () => {
    // Create workbook with multiple sheets
    const workbook = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ['Bulk Upload Summary Report'],
      [''],
      ['Total Processed', result.totalProcessed],
      ['Successfully Created', result.successCount],
      ['Updated', result.updatedCount],
      ['Skipped', result.skippedCount],
      ['Errors', result.errorCount],
      [''],
      ['Generated at', new Date().toLocaleString()]
    ]
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    // All results sheet
    const allResultsData = [
      ['Row', 'Email', 'Full Name', 'Status', 'Message', 'Member ID']
    ]
    result.results.forEach(r => {
      allResultsData.push([
        r.rowNumber.toString(),
        r.email,
        r.fullName,
        r.status,
        r.message,
        r.memberId || ''
      ])
    })
    const allResultsSheet = XLSX.utils.aoa_to_sheet(allResultsData)
    XLSX.utils.book_append_sheet(workbook, allResultsSheet, 'All Results')

    // Errors sheet (if any)
    if (errorResults.length > 0) {
      const errorData = [['Row', 'Email', 'Full Name', 'Error Message']]
      errorResults.forEach(r => {
        errorData.push([r.rowNumber.toString(), r.email, r.fullName, r.message])
      })
      const errorSheet = XLSX.utils.aoa_to_sheet(errorData)
      XLSX.utils.book_append_sheet(workbook, errorSheet, 'Errors')
    }

    // Download
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bulk_upload_report_${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'updated':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return null
    }
  }

  const ResultsTable = ({ results }: { results: BulkUploadRowResult[] }) => (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]">Row</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No results in this category
              </TableCell>
            </TableRow>
          ) : (
            results.map((r, idx) => (
              <TableRow key={`${r.rowNumber}-${idx}`}>
                <TableCell className="font-mono text-xs">{r.rowNumber}</TableCell>
                <TableCell className="font-mono text-sm">{r.email}</TableCell>
                <TableCell>{r.fullName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(r.status)}
                    <span className="capitalize text-sm">{r.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                  {r.message}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  )

  return (
    <div className="space-y-6">
      {/* Success Banner or Error Banner */}
      <Card
        className={cn(
          'border-2',
          result.errorCount === 0
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : result.successCount > 0
            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-destructive bg-destructive/10'
        )}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {result.errorCount === 0 ? (
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              ) : result.successCount > 0 ? (
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
              <div>
                <h2 className="text-2xl font-bold">
                  {result.errorCount === 0
                    ? 'Upload Completed Successfully!'
                    : result.successCount > 0
                    ? 'Upload Completed with Some Errors'
                    : 'Upload Failed'}
                </h2>
                <p className="text-muted-foreground">
                  {result.successCount} members created
                  {result.updatedCount > 0 && `, ${result.updatedCount} updated`}
                  {result.skippedCount > 0 && `, ${result.skippedCount} skipped`}
                  {result.errorCount > 0 && `, ${result.errorCount} failed`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold">{result.totalProcessed}</div>
            <p className="text-sm text-muted-foreground">Total Processed</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-green-600">{result.successCount}</div>
            <p className="text-sm text-muted-foreground">Created</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-blue-600">{result.updatedCount}</div>
            <p className="text-sm text-muted-foreground">Updated</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-destructive">{result.errorCount}</div>
            <p className="text-sm text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Results Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Results</CardTitle>
          <CardDescription>
            Review the status of each imported member
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                All ({result.results.length})
              </TabsTrigger>
              <TabsTrigger value="success" className="text-green-600">
                Created ({successResults.length})
              </TabsTrigger>
              <TabsTrigger value="updated" className="text-blue-600">
                Updated ({updatedResults.length})
              </TabsTrigger>
              <TabsTrigger value="skipped" className="text-yellow-600">
                Skipped ({skippedResults.length})
              </TabsTrigger>
              <TabsTrigger value="errors" className="text-destructive">
                Errors ({errorResults.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ResultsTable results={result.results} />
            </TabsContent>
            <TabsContent value="success">
              <ResultsTable results={successResults} />
            </TabsContent>
            <TabsContent value="updated">
              <ResultsTable results={updatedResults} />
            </TabsContent>
            <TabsContent value="skipped">
              <ResultsTable results={skippedResults} />
            </TabsContent>
            <TabsContent value="errors">
              <ResultsTable results={errorResults} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button variant="outline" onClick={downloadReport}>
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Upload Another File
          </Button>
        </div>
        <Button asChild>
          <Link href="/members">
            <Users className="mr-2 h-4 w-4" />
            View All Members
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
