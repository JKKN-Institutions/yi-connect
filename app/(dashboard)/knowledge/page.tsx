/**
 * Knowledge Module - Knowledge Management System
 * Module 8: Digital repository for reports, MoUs, templates, and best practices
 *
 * Status: Not Started (0%)
 * Priority: MEDIUM - Phase 2
 */

import { BookOpen, FileText, FolderOpen, Search, BookMarked, Share2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Management System</h1>
            <p className="text-muted-foreground">
              Module 8 - Digital Repository for Reports, MoUs, Templates & Best Practices
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge variant="secondary">Module 8</Badge>
          <Badge variant="outline">Phase 2 - Collaboration</Badge>
          <Badge variant="destructive">Not Started</Badge>
        </div>
      </div>

      {/* Coming Soon Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This module is currently under development. It will provide a comprehensive knowledge repository
          with full-text search, version control, and national content sync.
        </AlertDescription>
      </Alert>

      {/* Document Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Reports & Documents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Event reports, financial statements, and chapter documentation with version history
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Templates Library</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Reusable templates for events, proposals, budgets, and official communications
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Best Practices</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Documented guidelines, SOPs, and successful case studies from chapter activities
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">MoUs & Agreements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Centralized storage for all memorandums of understanding and legal agreements
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Full-Text Search</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Advanced search across all documents with filters and tag-based navigation
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">National Sync</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Synchronize important documents with national-level repository for knowledge sharing
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Key Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>Comprehensive knowledge management and document repository</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Document upload with automatic categorization and tagging</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Version control with change tracking and rollback capabilities</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Full-text search with OCR support for scanned documents</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Wiki-style pages for collaborative documentation</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Access controls with role-based permissions</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Document expiry alerts for MoUs and time-sensitive agreements</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Template marketplace for sharing reusable resources</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5" />
              <span>Integration with national repository for best practices sharing</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Implementation Info */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Status</CardTitle>
          <CardDescription>Module 8 - Knowledge Management System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Priority</h4>
            <p className="text-sm text-muted-foreground">
              MEDIUM - Phase 2 Collaboration Module (To be implemented in Q2)
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Estimated Timeline</h4>
            <p className="text-sm text-muted-foreground">
              4-5 weeks for full implementation including search, wiki, and sync features
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Dependencies</h4>
            <p className="text-sm text-muted-foreground">
              Module 2 (Stakeholders) for MoU integration; Module 10 (National Integration) for sync
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
