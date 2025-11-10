/**
 * Skills & Certifications Display Components
 *
 * Display member skills and certifications with management actions.
 */

'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  deleteMemberSkill,
  deleteMemberCertification
} from '@/app/actions/members';
import {
  Award,
  BookOpen,
  Calendar,
  Edit,
  ExternalLink,
  MoreVertical,
  Plus,
  Trash,
  Users,
  AlertTriangle
} from 'lucide-react';
import type {
  MemberWithSkills,
  MemberWithCertifications
} from '@/types/member';

interface SkillsDisplayProps {
  member: MemberWithSkills;
  onAddSkill?: () => void;
  onEditSkill?: (skillId: string) => void;
}

interface CertificationsDisplayProps {
  member: MemberWithCertifications;
  onAddCertification?: () => void;
  onEditCertification?: (certificationId: string) => void;
}

function getProficiencyColor(proficiency: string): string {
  const colors: Record<string, string> = {
    beginner:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300',
    intermediate:
      'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
    advanced:
      'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-300',
    expert:
      'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-amber-300'
  };
  return colors[proficiency] || colors.beginner;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    technical: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    business:
      'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
    creative:
      'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    leadership:
      'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
    communication:
      'bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-400',
    other: 'bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400'
  };
  return colors[category] || colors.other;
}

export function SkillsDisplay({
  member,
  onAddSkill,
  onEditSkill
}: SkillsDisplayProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteMemberSkill(id);
      setDeleteId(null);
    });
  };

  // Group skills by category
  const skillsByCategory = member.skills.reduce((acc, memberSkill) => {
    const category = memberSkill.skill.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(memberSkill);
    return acc;
  }, {} as Record<string, typeof member.skills>);

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Skills & Expertise</CardTitle>
              <CardDescription>
                {member.skills.length} skill
                {member.skills.length !== 1 ? 's' : ''} •{' '}
                {member.skills.filter((s) => s.is_willing_to_mentor).length}{' '}
                mentor
                {member.skills.filter((s) => s.is_willing_to_mentor).length !==
                1
                  ? 's'
                  : ''}
              </CardDescription>
            </div>
            {onAddSkill && (
              <Button onClick={onAddSkill} size='sm'>
                <Plus className='h-4 w-4 mr-2' />
                Add Skill
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {member.skills.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <BookOpen className='h-12 w-12 mx-auto mb-4 opacity-20' />
              <p>No skills added yet</p>
              {onAddSkill && (
                <Button onClick={onAddSkill} variant='outline' className='mt-4'>
                  Add First Skill
                </Button>
              )}
            </div>
          ) : (
            <div className='space-y-6'>
              {Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category}>
                  <div className='flex items-center gap-2 mb-3'>
                    <Badge
                      variant='outline'
                      className={getCategoryColor(category)}
                    >
                      {category}
                    </Badge>
                    <Separator className='flex-1' />
                  </div>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {skills.map((memberSkill) => (
                      <div
                        key={memberSkill.id}
                        className='flex items-start justify-between p-3 rounded-lg border bg-card'
                      >
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center gap-2 mb-2'>
                            <h4 className='font-medium truncate'>
                              {memberSkill.skill.name}
                            </h4>
                            {memberSkill.is_willing_to_mentor && (
                              <Users className='h-4 w-4 text-primary shrink-0' />
                            )}
                          </div>
                          <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                            <Badge
                              variant='outline'
                              className={getProficiencyColor(
                                memberSkill.proficiency
                              )}
                            >
                              {memberSkill.proficiency}
                            </Badge>
                            {memberSkill.years_of_experience && (
                              <span className='text-xs'>
                                {memberSkill.years_of_experience} yr
                                {memberSkill.years_of_experience !== 1
                                  ? 's'
                                  : ''}
                              </span>
                            )}
                          </div>
                          {memberSkill.notes && (
                            <p className='text-xs text-muted-foreground mt-2 line-clamp-2'>
                              {memberSkill.notes}
                            </p>
                          )}
                        </div>
                        {(onEditSkill || true) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8 shrink-0'
                              >
                                <MoreVertical className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              {onEditSkill && (
                                <DropdownMenuItem
                                  onClick={() => onEditSkill(memberSkill.id)}
                                >
                                  <Edit className='h-4 w-4 mr-2' />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className='text-destructive'
                                onClick={() => setDeleteId(memberSkill.id)}
                              >
                                <Trash className='h-4 w-4 mr-2' />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove skill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the skill from this member&apos;s profile. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isPending ? 'Removing...' : 'Remove Skill'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CertificationsDisplay({
  member,
  onAddCertification,
  onEditCertification
}: CertificationsDisplayProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteMemberCertification(id);
      setDeleteId(null);
    });
  };

  const expiringCertifications = member.certifications.filter(
    (cert) => cert.is_expiring_soon
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Certifications</CardTitle>
              <CardDescription>
                {member.certifications.length} certification
                {member.certifications.length !== 1 ? 's' : ''}
                {expiringCertifications.length > 0 && (
                  <span className='text-orange-600 dark:text-orange-400 ml-2'>
                    • {expiringCertifications.length} expiring soon
                  </span>
                )}
              </CardDescription>
            </div>
            {onAddCertification && (
              <Button onClick={onAddCertification} size='sm'>
                <Plus className='h-4 w-4 mr-2' />
                Add Certification
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {member.certifications.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Award className='h-12 w-12 mx-auto mb-4 opacity-20' />
              <p>No certifications added yet</p>
              {onAddCertification && (
                <Button
                  onClick={onAddCertification}
                  variant='outline'
                  className='mt-4'
                >
                  Add First Certification
                </Button>
              )}
            </div>
          ) : (
            <div className='space-y-3'>
              {member.certifications.map((memberCert) => (
                <div
                  key={memberCert.id}
                  className={`p-4 rounded-lg border bg-card ${
                    memberCert.is_expiring_soon
                      ? 'border-orange-300 dark:border-orange-800'
                      : ''
                  }`}
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium'>
                          {memberCert.certification.name}
                        </h4>
                        {memberCert.is_expiring_soon && (
                          <Badge
                            variant='outline'
                            className='bg-orange-50 text-orange-700 border-orange-300'
                          >
                            <AlertTriangle className='h-3 w-3 mr-1' />
                            Expiring Soon
                          </Badge>
                        )}
                      </div>
                      <p className='text-sm text-muted-foreground mb-3'>
                        {memberCert.certification.issuing_organization}
                      </p>

                      <div className='grid gap-2 text-sm'>
                        {memberCert.certificate_number && (
                          <div className='flex items-center gap-2 text-muted-foreground'>
                            <Award className='h-4 w-4 shrink-0' />
                            <span>
                              Certificate: {memberCert.certificate_number}
                            </span>
                          </div>
                        )}
                        <div className='flex items-center gap-2 text-muted-foreground'>
                          <Calendar className='h-4 w-4 shrink-0' />
                          <span>
                            Issued:{' '}
                            {new Date(
                              memberCert.issued_date
                            ).toLocaleDateString()}
                            {memberCert.expiry_date && (
                              <>
                                {' '}
                                • Expires:{' '}
                                {new Date(
                                  memberCert.expiry_date
                                ).toLocaleDateString()}
                              </>
                            )}
                          </span>
                        </div>
                        {memberCert.document_url && (
                          <a
                            href={memberCert.document_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex items-center gap-2 text-primary hover:underline w-fit'
                          >
                            <ExternalLink className='h-4 w-4' />
                            <span>View Certificate</span>
                          </a>
                        )}
                      </div>

                      {memberCert.notes && (
                        <p className='text-sm text-muted-foreground mt-3 p-2 rounded bg-muted/50'>
                          {memberCert.notes}
                        </p>
                      )}
                    </div>

                    {(onEditCertification || true) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 shrink-0'
                          >
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          {onEditCertification && (
                            <DropdownMenuItem
                              onClick={() => onEditCertification(memberCert.id)}
                            >
                              <Edit className='h-4 w-4 mr-2' />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={() => setDeleteId(memberCert.id)}
                          >
                            <Trash className='h-4 w-4 mr-2' />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove certification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the certification from this member&apos;s
              profile. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isPending}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isPending ? 'Removing...' : 'Remove Certification'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
