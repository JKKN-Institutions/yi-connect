/**
 * Member Detail Client Component
 *
 * Client-side interactive parts for member detail page.
 */

'use client'

import { useState } from 'react'
import {
  SkillsDisplay,
  CertificationsDisplay,
  AddSkillDialog,
  UpdateSkillDialog,
  AddCertificationDialog,
  UpdateCertificationDialog,
} from '@/components/members'

interface MemberDetailClientProps {
  member: any // TODO: Add proper type
}

export function MemberDetailClient({ member }: MemberDetailClientProps) {
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [showEditSkill, setShowEditSkill] = useState<string | null>(null)
  const [showAddCertification, setShowAddCertification] = useState(false)
  const [showEditCertification, setShowEditCertification] = useState<string | null>(null)

  return (
    <>
      {/* Skills Section */}
      <SkillsDisplay
        member={member}
        onAddSkill={() => setShowAddSkill(true)}
        onEditSkill={(id) => setShowEditSkill(id)}
      />

      {/* Certifications Section */}
      <CertificationsDisplay
        member={member}
        onAddCertification={() => setShowAddCertification(true)}
        onEditCertification={(id) => setShowEditCertification(id)}
      />

      {/* Dialogs */}
      {showAddSkill && (
        <AddSkillDialog
          memberId={member.id}
          skills={[]} // TODO: Pass skills list
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
          certifications={[]} // TODO: Pass certifications list
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
