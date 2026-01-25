/**
 * Activity Templates Library Page
 *
 * Browse and manage pre-defined activity templates
 */

import Link from 'next/link'
import {
  Plus,
  BookTemplate,
  Clock,
  Users,
  Tag,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { requireRole, getCurrentChapterId } from '@/lib/auth'
import { getActivityTemplates, getPopularTemplates } from '@/lib/data/activity-templates'
import { getVerticalsForForm } from '@/lib/data/health-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  getAAAColor,
  getAAAShortLabel,
  type ActivityTemplate,
} from '@/types/activity-templates'

export const metadata = {
  title: 'Activity Templates - Pathfinder',
  description: 'Pre-defined templates for quick activity logging',
}

export default async function TemplatesPage() {
  const { user, roles } = await requireRole([
    'Super Admin',
    'National Admin',
    'Chair',
    'Co-Chair',
    'Vertical Head',
    'EC Member',
  ])

  const userRoles = roles || []
  const canManageTemplates =
    userRoles.includes('Chair') ||
    userRoles.includes('Super Admin') ||
    userRoles.includes('National Admin') ||
    userRoles.includes('Co-Chair')

  // Get templates and verticals
  const [templates, popularTemplates, verticals] = await Promise.all([
    getActivityTemplates(),
    getPopularTemplates(6),
    getVerticalsForForm(),
  ])

  const hasTemplates = templates.length > 0

  // Group templates by vertical
  const templatesByVertical = templates.reduce((acc, template) => {
    const verticalName = template.vertical?.name || 'General'
    if (!acc[verticalName]) {
      acc[verticalName] = []
    }
    acc[verticalName].push(template)
    return acc
  }, {} as Record<string, ActivityTemplate[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookTemplate className="h-6 w-6 text-indigo-600" />
            Activity Templates
          </h1>
          <p className="text-muted-foreground">
            Quick-start templates for common Yi activities
          </p>
        </div>
        {canManageTemplates && (
          <Button asChild>
            <Link href="/pathfinder/templates/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Link>
          </Button>
        )}
      </div>

      {/* No Templates Alert */}
      {!hasTemplates && (
        <Alert>
          <BookTemplate className="h-4 w-4" />
          <AlertTitle>No templates available</AlertTitle>
          <AlertDescription>
            Activity templates haven&apos;t been set up yet.
            {canManageTemplates && (
              <>
                {' '}
                <Link href="/pathfinder/templates/new" className="underline font-medium">
                  Create the first template →
                </Link>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Popular Templates */}
      {popularTemplates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Popular Templates
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {popularTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                showUseButton
              />
            ))}
          </div>
        </div>
      )}

      {/* Templates by Vertical */}
      {Object.entries(templatesByVertical).map(([verticalName, verticalTemplates]) => (
        <div key={verticalName}>
          <h2 className="text-lg font-semibold mb-4">{verticalName}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {verticalTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                showUseButton
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TemplateCard({
  template,
  showUseButton = false,
}: {
  template: ActivityTemplate
  showUseButton?: boolean
}) {
  return (
    <Card className="hover:border-indigo-300 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {template.vertical && (
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.vertical.color || '#6b7280' }}
              />
            )}
            {template.name}
          </CardTitle>
          {template.default_aaa_classification && (
            <Badge
              variant="outline"
              className={getAAAColor(template.default_aaa_classification)}
            >
              {getAAAShortLabel(template.default_aaa_classification)}
            </Badge>
          )}
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Expected metrics */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          {template.expected_participants && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              ~{template.expected_participants}
            </span>
          )}
          {template.default_duration_hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {template.default_duration_hours}h
            </span>
          )}
          {template.usage_count > 0 && (
            <span className="text-xs">
              Used {template.usage_count}x
            </span>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="h-2 w-2 mr-1" />
                {tag}
              </Badge>
            ))}
            {template.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Use button */}
        {showUseButton && (
          <Button asChild className="w-full" variant="outline" size="sm">
            <Link href={`/pathfinder/health-card/new?template=${template.id}`}>
              Use Template
              <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
