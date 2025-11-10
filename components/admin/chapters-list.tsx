/**
 * Chapters List Component
 *
 * Display list of chapters with admin actions
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteChapter } from '@/app/actions/chapters'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, MapPin, Calendar, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { ChapterListItem } from '@/types/chapter'
import { format } from 'date-fns'

interface ChaptersListProps {
  chapters: ChapterListItem[]
}

export function ChaptersList({ chapters }: ChaptersListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chapterToDelete, setChapterToDelete] = useState<ChapterListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDeleteClick = (chapter: ChapterListItem) => {
    setChapterToDelete(chapter)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!chapterToDelete) return

    setIsDeleting(true)
    const result = await deleteChapter(chapterToDelete.id)

    if (result.success) {
      toast.success(result.message || 'Chapter deleted successfully')
      setDeleteDialogOpen(false)
      router.refresh()
    } else {
      toast.error(result.message || 'Failed to delete chapter')
    }
    setIsDeleting(false)
  }

  if (chapters.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No chapters found</p>
            <Button asChild>
              <Link href="/admin/chapters/new">Create First Chapter</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chapters</CardTitle>
              <CardDescription>
                Manage Yi chapters across different regions
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/admin/chapters/new">Create Chapter</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chapter Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Established</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chapters.map((chapter) => (
                <TableRow key={chapter.id}>
                  <TableCell className="font-medium">{chapter.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {chapter.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    {chapter.region ? (
                      <Badge variant="secondary">{chapter.region}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {chapter.established_date ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(chapter.established_date), 'MMM yyyy')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{chapter.member_count || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Edit chapter"
                      >
                        <Link href={`/admin/chapters/${chapter.id}/edit`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(chapter)}
                        title="Delete chapter"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chapter</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{chapterToDelete?.name}</strong>?
              {chapterToDelete && chapterToDelete.member_count > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  This chapter has {chapterToDelete.member_count} member(s). You must
                  reassign members before deleting.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
