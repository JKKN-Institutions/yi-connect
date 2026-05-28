/**
 * Add Members Page
 *
 * Add new members to the sub-chapter.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  UserPlus,
  Users,
  CheckCircle2,
} from 'lucide-react'
import {
  addSubChapterMember,
  bulkAddSubChapterMembers,
} from '@/app/actions/sub-chapters'

const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Alumni']

export default function AddMembersPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)

    const subChapterId = document.cookie
      .split('; ')
      .find((row) => row.startsWith('sub_chapter_id='))
      ?.split('=')[1]

    if (!subChapterId) {
      setError('Session expired. Please login again.')
      setIsLoading(false)
      return
    }

    const result = await addSubChapterMember({
      sub_chapter_id: subChapterId,
      full_name: formData.get('full_name') as string,
      email: (formData.get('email') as string) || undefined,
      phone: (formData.get('phone') as string) || undefined,
      student_id: (formData.get('student_id') as string) || undefined,
      department: (formData.get('department') as string) || undefined,
      year_of_study: (formData.get('year_of_study') as string) || undefined,
    })

    setIsLoading(false)

    if (result.success) {
      setSuccess('Member added successfully!')
      ;(e.target as HTMLFormElement).reset()
    } else {
      setError(result.error)
    }
  }

  async function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const formData = new FormData(e.currentTarget)
    const csvData = formData.get('csv_data') as string

    const subChapterId = document.cookie
      .split('; ')
      .find((row) => row.startsWith('sub_chapter_id='))
      ?.split('=')[1]

    if (!subChapterId) {
      setError('Session expired. Please login again.')
      setIsLoading(false)
      return
    }

    // Parse CSV data
    const lines = csvData.trim().split('\n')
    const members: Array<{
      full_name: string
      email?: string
      phone?: string
      student_id?: string
      department?: string
      year_of_study?: string
    }> = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Skip header row if present
      if (i === 0 && line.toLowerCase().includes('name')) continue

      const parts = line.split(',').map((p) => p.trim())
      if (parts.length < 1 || !parts[0]) continue

      members.push({
        full_name: parts[0],
        student_id: parts[1] || undefined,
        department: parts[2] || undefined,
        year_of_study: parts[3] || undefined,
        email: parts[4] || undefined,
        phone: parts[5] || undefined,
      })
    }

    if (members.length === 0) {
      setError('No valid members found in the data')
      setIsLoading(false)
      return
    }

    const result = await bulkAddSubChapterMembers(subChapterId, members)

    setIsLoading(false)

    if (result.success) {
      setSuccess(`Successfully added ${result.data?.addedCount} members!`)
      ;(e.target as HTMLFormElement).reset()
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chapter-lead/members">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Add Members
          </h1>
          <p className="text-muted-foreground mt-1">
            Add new students to your chapter
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Add Single Member
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Users className="h-4 w-4" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        {/* Single Member Form */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Add Single Member</CardTitle>
              <CardDescription>
                Enter details for a new member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      placeholder="Student name"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student_id">Student ID</Label>
                    <Input
                      id="student_id"
                      name="student_id"
                      placeholder="e.g., STU2024001"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="student@example.com"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      name="department"
                      placeholder="e.g., Computer Science"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year_of_study">Year of Study</Label>
                    <Select name="year_of_study" disabled={isLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/chapter-lead/members">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Import Form */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import Members</CardTitle>
              <CardDescription>
                Import multiple members from CSV data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBulkSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv_data">CSV Data</Label>
                  <Textarea
                    id="csv_data"
                    name="csv_data"
                    placeholder={`Name, Student ID, Department, Year, Email, Phone
John Doe, STU001, Computer Science, 2nd Year, john@email.com, 9876543210
Jane Smith, STU002, Electronics, 3rd Year, jane@email.com, 9876543211`}
                    rows={10}
                    required
                    disabled={isLoading}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: Name, Student ID, Department, Year, Email, Phone (one per line)
                  </p>
                </div>

                <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
                  <p className="font-medium">Tips:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Only Name is required, other fields are optional</li>
                    <li>You can copy-paste from Excel or Google Sheets</li>
                    <li>Header row (if present) will be automatically skipped</li>
                    <li>Duplicate entries will be added as separate members</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" asChild>
                    <Link href="/chapter-lead/members">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import Members
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
