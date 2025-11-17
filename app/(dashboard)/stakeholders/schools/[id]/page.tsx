/**
 * School Detail Page - Clean Professional Design
 *
 * A well-organized stakeholder detail page with professional aesthetics
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Users,
  Building2,
  Phone,
  Mail,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle2,
  Globe,
  Clock,
  User,
  Briefcase,
  GraduationCap,
  Shield
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  StakeholderStatusBadge,
  HealthTierBadge,
  MouStatusBadge,
  InteractionOutcomeBadge
} from '@/components/stakeholders/status-badges';
import { getSchoolById } from '@/lib/data/stakeholder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return [{ id: '00000000-0000-0000-0000-000000000000' }];
}

async function SchoolDetail({ schoolId }: { schoolId: string }) {
  const school = await getSchoolById(schoolId);

  if (!school) {
    notFound();
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 space-y-8 p-8'>
      {/* Header */}
      <div className='flex items-start justify-between animate-in fade-in slide-in-from-top duration-500'>
        <div className='flex items-start gap-6'>
          <Link href='/stakeholders/schools'>
            <Button
              variant='ghost'
              size='icon'
              className='hover:bg-white hover:shadow-md transition-all'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
          </Link>
          <div>
            <h1 className='text-4xl font-bold tracking-tight text-gray-900 mb-3'>
              {school.school_name}
            </h1>
            <div className='flex items-center gap-3'>
              <div className='flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 shadow-sm'>
                <Building2 className='h-4 w-4 text-gray-500' />
                <span className='text-sm font-medium capitalize text-gray-700'>
                  {school.school_type.replace('_', ' ')}
                </span>
              </div>
              <StakeholderStatusBadge status={school.status} />
            </div>
          </div>
        </div>
        <Button
          asChild
          className='bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg transition-all'
        >
          <Link href={`/stakeholders/schools/${school.id}/edit`}>
            <Edit className='mr-2 h-4 w-4' />
            Edit School
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className='grid gap-6 md:grid-cols-4'>
        <Card
          className='bg-white border-orange-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
          style={{ animationDelay: '100ms' }}
        >
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <Users className='h-8 w-8 text-orange-500' />
            </div>
            <div className='text-3xl font-bold text-gray-900 mb-1'>
              {school.total_students?.toLocaleString() || '–'}
            </div>
            <p className='text-sm text-gray-500 font-medium'>Total Students</p>
            {school.grade_range && (
              <p className='text-xs text-gray-400 mt-1'>{school.grade_range}</p>
            )}
          </CardContent>
        </Card>

        <Card
          className='bg-white border-teal-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
          style={{ animationDelay: '200ms' }}
        >
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <TrendingUp className='h-8 w-8 text-teal-600' />
            </div>
            {school.health_score ? (
              <>
                <div className='text-3xl font-bold text-gray-900 mb-1'>
                  {school.health_score.overall_score.toFixed(0)}
                  <span className='text-lg text-gray-400'>/100</span>
                </div>
                <HealthTierBadge tier={school.health_score.health_tier} />
              </>
            ) : (
              <>
                <div className='text-3xl font-bold text-gray-300 mb-1'>–</div>
                <p className='text-sm text-gray-400'>No health data</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card
          className='bg-white border-orange-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
          style={{ animationDelay: '300ms' }}
        >
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <Calendar className='h-8 w-8 text-orange-500' />
            </div>
            <div className='text-3xl font-bold text-gray-900 mb-1'>
              {school.interactions.length}
            </div>
            <p className='text-sm text-gray-500 font-medium'>Interactions</p>
            {school.health_score?.last_interaction_date ? (
              <p className='text-xs text-gray-400 mt-1'>
                Last:{' '}
                {new Date(
                  school.health_score.last_interaction_date
                ).toLocaleDateString()}
              </p>
            ) : (
              <p className='text-xs text-gray-400 mt-1'>No interactions yet</p>
            )}
          </CardContent>
        </Card>

        <Card
          className='bg-white border-teal-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
          style={{ animationDelay: '400ms' }}
        >
          <CardContent className='pt-6'>
            <div className='flex items-center justify-between mb-4'>
              <FileText className='h-8 w-8 text-teal-600' />
            </div>
            <div className='text-3xl font-bold text-gray-900 mb-1'>
              {school.mous.length}
            </div>
            <p className='text-sm text-gray-500 font-medium'>MoU Count</p>
            {school.mous[0] ? (
              <div className='mt-1'>
                <MouStatusBadge status={school.mous[0].mou_status} />
              </div>
            ) : (
              <p className='text-xs text-gray-400 mt-1'>No MoU signed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className='grid gap-8 lg:grid-cols-3'>
        {/* Left Column - School Information */}
        <div className='lg:col-span-2 space-y-8'>
          <Card className='bg-white border-t-4 border-t-orange-500 shadow-md rounded-lg border border-gray-100'>
            <CardHeader className='pb-4'>
              <h2 className='text-2xl font-bold text-gray-900'>
                School Information
              </h2>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Address */}
              <div className='grid md:grid-cols-2 gap-6'>
                <div>
                  <div className='flex items-start gap-3'>
                    <div className='mt-1 p-2 rounded-lg bg-gradient-to-br from-[#E76F51]/10 to-[#2A9D8F]/10'>
                      <MapPin className='h-5 w-5 text-[#E76F51]' />
                    </div>
                    <div>
                      <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1'>
                        Address
                      </p>
                      <div className='text-sm text-gray-700 leading-relaxed'>
                        {school.address_line1 && (
                          <div>{school.address_line1}</div>
                        )}
                        {school.address_line2 && (
                          <div>{school.address_line2}</div>
                        )}
                        <div className='font-medium mt-1'>
                          {school.city}, {school.state}
                          {school.pincode && ` - ${school.pincode}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {school.phone && (
                  <div>
                    <div className='flex items-start gap-3'>
                      <div className='mt-1 p-2 rounded-lg bg-gradient-to-br from-[#2A9D8F]/10 to-[#E76F51]/10'>
                        <Phone className='h-5 w-5 text-[#2A9D8F]' />
                      </div>
                      <div>
                        <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1'>
                          Contact
                        </p>
                        <a
                          href={`tel:${school.phone}`}
                          className='text-sm text-gray-700 hover:text-[#E76F51] transition-colors'
                        >
                          {school.phone}
                        </a>
                        {school.email && (
                          <a
                            href={`mailto:${school.email}`}
                            className='block text-sm text-gray-600 hover:text-[#2A9D8F] transition-colors mt-1'
                          >
                            {school.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Medium & Facilities */}
              <div className='grid md:grid-cols-2 gap-6'>
                {school.medium && school.medium.length > 0 && (
                  <div>
                    <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>
                      Medium of Instruction
                    </p>
                    <div className='flex flex-wrap gap-2'>
                      {school.medium.map((m) => (
                        <span
                          key={m}
                          className='px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>
                    Facilities Available
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {school.has_auditorium && (
                      <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-orange-500 hover:bg-orange-50 transition-colors'>
                        <CheckCircle2 className='h-3 w-3' />
                        Auditorium
                      </span>
                    )}
                    {school.has_smart_class && (
                      <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-orange-500 hover:bg-orange-50 transition-colors'>
                        <CheckCircle2 className='h-3 w-3' />
                        Smart Class
                      </span>
                    )}
                    {school.has_ground && (
                      <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-orange-500 hover:bg-orange-50 transition-colors'>
                        <CheckCircle2 className='h-3 w-3' />
                        Playground
                      </span>
                    )}
                    {school.has_parking && (
                      <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-orange-500 hover:bg-orange-50 transition-colors'>
                        <CheckCircle2 className='h-3 w-3' />
                        Parking
                      </span>
                    )}
                    {school.has_library && (
                      <span className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-gray-300 text-gray-700 hover:border-orange-500 hover:bg-orange-50 transition-colors'>
                        <CheckCircle2 className='h-3 w-3' />
                        Library
                      </span>
                    )}
                    {!school.has_auditorium &&
                      !school.has_smart_class &&
                      !school.has_ground &&
                      !school.has_parking &&
                      !school.has_library && (
                        <span className='text-sm text-gray-400'>
                          No facilities data
                        </span>
                      )}
                  </div>
                </div>
              </div>

              {/* Additional Info Grid */}
              <div className='grid md:grid-cols-3 gap-4 pt-4'>
                {school.decision_maker && (
                  <div className='p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100'>
                    <div className='flex items-center gap-2 mb-2'>
                      <User className='h-4 w-4 text-[#E76F51]' />
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Decision Maker
                      </p>
                    </div>
                    <p className='text-sm font-medium text-gray-900'>
                      {school.decision_maker}
                    </p>
                  </div>
                )}

                {school.best_time_to_approach && (
                  <div className='p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100'>
                    <div className='flex items-center gap-2 mb-2'>
                      <Clock className='h-4 w-4 text-[#2A9D8F]' />
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Best Time
                      </p>
                    </div>
                    <p className='text-sm font-medium text-gray-900'>
                      {school.best_time_to_approach}
                    </p>
                  </div>
                )}

                {school.lead_time_required && (
                  <div className='p-4 rounded-lg bg-gradient-to-br from-gray-50 to-white border border-gray-100'>
                    <div className='flex items-center gap-2 mb-2'>
                      <Calendar className='h-4 w-4 text-[#E76F51]' />
                      <p className='text-xs font-semibold text-gray-500 uppercase'>
                        Lead Time
                      </p>
                    </div>
                    <p className='text-sm font-medium text-gray-900'>
                      {school.lead_time_required}
                    </p>
                  </div>
                )}
              </div>

              {school.suitable_programs &&
                school.suitable_programs.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3'>
                        Suitable Yi Programs
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        {school.suitable_programs.map((program) => (
                          <span
                            key={program}
                            className='px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-sm'
                          >
                            {program}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              {school.notes && (
                <>
                  <Separator />
                  <div>
                    <p className='text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2'>
                      Notes
                    </p>
                    <p className='text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-100'>
                      {school.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Interactions Table */}
          {school.interactions.length > 0 && (
            <Card className='bg-white border-t-4 border-t-orange-500 shadow-md rounded-lg border border-gray-100'>
              <CardHeader>
                <h2 className='text-2xl font-bold text-gray-900'>Interaction History</h2>
                <p className='text-sm text-gray-500 mt-2'>
                  {school.interactions.length} total interaction
                  {school.interactions.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Led By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {school.interactions.slice(0, 10).map((interaction) => (
                      <TableRow key={interaction.id}>
                        <TableCell className='font-medium whitespace-nowrap'>
                          {new Date(
                            interaction.interaction_date
                          ).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline' className='capitalize'>
                            {interaction.interaction_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className='max-w-md'>
                          <p className='text-sm text-gray-700 line-clamp-2'>
                            {interaction.summary}
                          </p>
                          {interaction.next_steps && (
                            <p className='text-xs text-gray-500 mt-1 italic'>
                              → {interaction.next_steps}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <InteractionOutcomeBadge
                            outcome={interaction.outcome}
                          />
                        </TableCell>
                        <TableCell className='text-sm text-gray-600'>
                          {interaction.led_by?.profiles?.full_name || '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* MoUs Section */}
          {school.mous.length > 0 && (
            <Card className='bg-white border-t-4 border-t-orange-500 shadow-md rounded-lg border border-gray-100'>
              <CardHeader>
                <h2 className='text-2xl font-bold text-gray-900'>
                  Memorandums of Understanding
                </h2>
                <p className='text-sm text-gray-500 mt-2'>
                  {school.mous.length} active MoU
                  {school.mous.length !== 1 ? 's' : ''}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Signed Date</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Document</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {school.mous.map((mou) => (
                      <TableRow key={mou.id}>
                        <TableCell className='font-medium'>
                          {mou.mou_title}
                        </TableCell>
                        <TableCell>
                          <MouStatusBadge status={mou.mou_status} />
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {mou.signed_date
                            ? new Date(mou.signed_date).toLocaleDateString()
                            : '–'}
                        </TableCell>
                        <TableCell className='whitespace-nowrap'>
                          {mou.valid_to
                            ? new Date(mou.valid_to).toLocaleDateString()
                            : '–'}
                        </TableCell>
                        <TableCell>
                          {mou.document_url ? (
                            <Button variant='ghost' size='sm' asChild>
                              <a
                                href={mou.document_url}
                                target='_blank'
                                rel='noopener noreferrer'
                              >
                                <FileText className='h-4 w-4' />
                              </a>
                            </Button>
                          ) : (
                            <span className='text-xs text-gray-400'>–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Contacts */}
        <div className='lg:col-span-1'>
          <Card className='bg-white border-t-4 border-t-orange-500 shadow-md rounded-lg border border-gray-100 sticky top-8'>
            <CardHeader>
              <h2 className='text-2xl font-bold text-gray-900'>Key Contacts</h2>
              <p className='text-sm text-gray-500 mt-2'>
                {school.contacts.length} contact
                {school.contacts.length !== 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardContent>
              {school.contacts.length > 0 ? (
                <div className='space-y-4'>
                  {school.contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className='p-4 rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:shadow-md transition-all'
                    >
                      <div className='flex items-start justify-between mb-3'>
                        <div>
                          <p className='font-semibold text-gray-900'>
                            {contact.contact_name}
                          </p>
                          {contact.designation && (
                            <p className='text-sm text-gray-500 mt-1'>
                              {contact.designation}
                            </p>
                          )}
                        </div>
                        <div className='flex flex-col gap-1'>
                          {contact.is_primary_contact && (
                            <Badge className='text-xs bg-[#E76F51] hover:bg-[#d45f41]'>
                              Primary
                            </Badge>
                          )}
                          {contact.is_decision_maker && (
                            <Badge className='text-xs bg-[#2A9D8F] hover:bg-[#238276]'>
                              Decision Maker
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className='space-y-2'>
                        {contact.email && (
                          <div className='flex items-center gap-2 text-sm'>
                            <Mail className='h-3.5 w-3.5 text-gray-400' />
                            <a
                              href={`mailto:${contact.email}`}
                              className='text-gray-600 hover:text-[#E76F51] transition-colors truncate'
                            >
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone_primary && (
                          <div className='flex items-center gap-2 text-sm'>
                            <Phone className='h-3.5 w-3.5 text-gray-400' />
                            <a
                              href={`tel:${contact.phone_primary}`}
                              className='text-gray-600 hover:text-[#2A9D8F] transition-colors'
                            >
                              {contact.phone_primary}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-12'>
                  <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4'>
                    <User className='h-8 w-8 text-gray-400' />
                  </div>
                  <p className='text-sm text-gray-500'>No contacts added yet</p>
                  <p className='text-xs text-gray-400 mt-1'>
                    Add contacts to manage relationships
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default async function SchoolDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<SchoolDetailSkeleton />}>
      <SchoolDetail schoolId={id} />
    </Suspense>
  );
}

function SchoolDetailSkeleton() {
  return (
    <div
      className='space-y-8 p-8'
      style={{
        background: 'linear-gradient(135deg, #faf8f6 0%, #f5f1ed 100%)'
      }}
    >
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-6'>
          <Skeleton className='h-10 w-10 rounded-lg' />
          <div className='space-y-3'>
            <Skeleton className='h-12 w-[400px]' />
            <Skeleton className='h-6 w-[250px]' />
          </div>
        </div>
        <Skeleton className='h-10 w-32' />
      </div>

      <div className='grid gap-6 md:grid-cols-4'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-[140px] rounded-lg' />
        ))}
      </div>

      <div className='grid gap-8 lg:grid-cols-3'>
        <div className='lg:col-span-2 space-y-8'>
          <Skeleton className='h-[500px] rounded-lg' />
          <Skeleton className='h-[400px] rounded-lg' />
        </div>
        <div className='lg:col-span-1'>
          <Skeleton className='h-[600px] rounded-lg' />
        </div>
      </div>
    </div>
  );
}
