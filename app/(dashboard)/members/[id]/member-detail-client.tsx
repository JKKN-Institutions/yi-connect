/**
 * Member Detail Client Component
 *
 * Client-side interactive parts for member detail page.
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  SkillsDisplay,
  CertificationsDisplay,
  AddSkillDialog,
  UpdateSkillDialog,
  AddCertificationDialog,
  UpdateCertificationDialog,
  AssessmentTab,
  AvailabilityCalendar,
} from '@/components/members'
import { TrainerProfileTab } from '@/components/members/trainer-profile-tab'
import { Briefcase, GraduationCap, Award, Target, Calendar } from 'lucide-react'
import type { TrainerProfileFull } from '@/types/trainer'
import type { SkillWillAssessmentFull } from '@/types/assessment'
import type { Availability } from '@/types/availability'
import type { Skill, Certification } from '@/types/member'

interface MemberDetailClientProps {
  member: any // TODO: Add proper type
  trainerProfile?: TrainerProfileFull | null
  assessment?: SkillWillAssessmentFull | null
  verticals?: Array<{ id: string; name: string; color: string | null }>
  availableMentors?: Array<{
    member_id: string
    full_name: string
    mentee_count: number
  }>
  availabilities?: Availability[]
  skills?: Skill[]
  certifications?: Certification[]
  canEdit?: boolean
}

export function MemberDetailClient({
  member,
  trainerProfile,
  assessment,
  verticals = [],
  availableMentors = [],
  availabilities = [],
  skills = [],
  certifications = [],
  canEdit = true,
}: MemberDetailClientProps) {
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showEditSkill, setShowEditSkill] = useState<string | null>(null)
  const [showAddCertification, setShowAddCertification] = useState(false)
  const [showEditCertification, setShowEditCertification] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('skills')

  return (
    <>
      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="skills" className="gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Skills & Certs</span>
            <span className="sm:hidden">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="assessment" className="gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Assessment</span>
            <span className="sm:hidden">Assess</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Availability</span>
            <span className="sm:hidden">Avail</span>
          </TabsTrigger>
          <TabsTrigger value="trainer" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">Trainer Profile</span>
            <span className="sm:hidden">Trainer</span>
          </TabsTrigger>
          <TabsTrigger value="engagement" className="gap-2">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Engagement</span>
            <span className="sm:hidden">Engage</span>
          </TabsTrigger>
        </TabsList>

        {/* Skills & Certifications Tab */}
        <TabsContent value="skills" className="space-y-6">
          <SkillsDisplay
            member={member}
            onAddSkill={() => setShowAddSkill(true)}
            onEditSkill={(id) => setShowEditSkill(id)}
          />
          <CertificationsDisplay
            member={member}
            onAddCertification={() => setShowAddCertification(true)}
            onEditCertification={(id) => setShowEditCertification(id)}
          />
        </TabsContent>

        {/* Assessment Tab */}
        <TabsContent value="assessment" className="space-y-6">
          <AssessmentTab
            assessment={assessment || null}
            memberId={member.id}
            chapterId={member.chapter_id}
            verticals={verticals}
            availableMentors={availableMentors}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* Availability Tab */}
        <TabsContent value="availability" className="space-y-6">
          <AvailabilityCalendar
            memberId={member.id}
            initialAvailabilities={availabilities}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* Trainer Profile Tab */}
        <TabsContent value="trainer" className="space-y-6">
          <TrainerProfileTab
            trainerProfile={trainerProfile || null}
            memberId={member.id}
            onCreateProfile={() => {
              // TODO: Implement create trainer profile dialog
              console.log('Create trainer profile for', member.id)
            }}
          />
        </TabsContent>

        {/* Engagement Tab (Placeholder for future) */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="text-center py-12 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium">Engagement Metrics</h3>
            <p className="text-sm">Coming soon - Track member engagement and leadership readiness.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showAddSkill && (
        <AddSkillDialog
          memberId={member.id}
          skills={skills}
          open={showAddSkill}
          onOpenChange={setShowAddSkill}
        />
      )}

      {showEditSkill && (
        <UpdateSkillDialog
          skillId={showEditSkill}
          currentProficiency="intermediate" // TODO: Get from selected skill
          currentExperience={0}
          currentMentor={false}
          currentNotes=""
          open={!!showEditSkill}
          onOpenChange={(open) => !open && setShowEditSkill(null)}
        />
      )}

      {showAddCertification && (
        <AddCertificationDialog
          memberId={member.id}
          certifications={certifications}
          open={showAddCertification}
          onOpenChange={setShowAddCertification}
        />
      )}

      {showEditCertification && (
        <UpdateCertificationDialog
          certificationId={showEditCertification}
          currentCertificateNumber=""
          currentIssuedDate=""
          currentExpiryDate=""
          currentDocumentUrl=""
          currentNotes=""
          open={!!showEditCertification}
          onOpenChange={(open) => !open && setShowEditCertification(null)}
        />
      )}
    </>
  )
}
