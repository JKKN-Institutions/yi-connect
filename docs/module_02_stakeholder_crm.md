# Module 2: Stakeholder Relationship CRM 🏋️‍♂️🏢🛋️

## Purpose
Transform scattered stakeholder information (in heads, WhatsApp, emails) into organized, searchable, relationship-health-scored data that enables systematic engagement and prevents duplicate/missed opportunities.

---

## 2.1 Stakeholder Taxonomy

### Stakeholder Types
Separate entities with similar fields but distinct workflows:
- **Schools** – Program delivery
- **Colleges** – Yuva, training
- **Industries** – CSR, sponsorships
- **Government** – Permissions, collaboration
- **NGOs** – Partnerships
- **Vendors** – Event services
- **Speakers/Trainers** – Experts, facilitators

### Why Separate Entities
Different fields and workflows for each stakeholder (e.g., School MoU vs Vendor Contract).

---

## 2.2 Schools CRM (CRUD)

### Create – Add New School
#### Basic Information
- School Name *(required)*
- School Type *(Primary, Secondary, High School, CBSE, State Board, Matric)*
- Address, City (default: Erode), Pincode
- Phone, Email *(optional)*
- Website *(optional)*

#### Key Contacts (Repeating Section)
Each contact includes: Name, Designation, Phone, Email, Preferred Contact, Notes.

#### Relationship Info
- How Connected *(Direct / Through Member / NGO / Cold)*
- If Member-connected: select member + relationship note

#### School Profile
- Total Students, Grades, Medium, Type (Co-ed, Boys, Girls)
- Govt/Private, suitable Yi programs (Masoom, Road Safety, etc.)

#### MoU Status
- Yes / No / In Discussion
- MoU Date, Duration, Expiry, File upload

#### Operational Info
- Best Time to Approach (e.g., avoid March-April)
- Decision Maker
- Lead Time Required (1 week → 3+ months)
- Facilities (Auditorium, Smart Class, Ground, Parking)

#### System-Calculated Fields
Relationship Health Score, Last Interaction, Sessions Conducted, Children Reached, Next Follow-up.

**After Creation:** prompt to schedule interaction, notify connected member, tag as *New School*.

Reusable: `<StakeholderForm/>`, `<ContactRepeater/>`, `<MemberConnectionPicker/>`, `<MoUTracker/>`, `<FacilityChecklist/>`, `<RelationshipHealthBadge/>`

---

### Read – Schools List
**Filters:** Type, MoU Status, Health, Suitable For, Last Interaction, Connected Through.

**Sort:** Name, Last Interaction, Sessions, Students, Health.

**List Card Example:**
> Railway School (CBSE, High School)
> 🟢 Health 85/100 | MoU Signed till Dec 2026  
> Students: 1,200 | Medium: English  
> Contact: Mr. Ravi Kumar (Principal)  
> Connected Through: Priya Navin  
> Sessions: 12 | Children: 2,400 | Last Interaction: Oct 15, 2025  
> [View] [Log Interaction] [Schedule]

**Map View:** shows schools color-coded by health score.

Reusable: `<StakeholderCard/>`, `<StakeholderList/>`, `<StakeholderMap/>`, `<HealthScoreBadge/>`

---

### Read – Individual School Profile
Tabs:
1. **Overview** – Basic info, contacts, facilities, suitable Yi programs.  
2. **Relationship** – Health breakdown (interaction frequency, responsiveness, quality, MoU).  
3. **Interaction History** – Timeline with events and attachments.  
4. **Impact Summary** – Stats + charts (sessions, children reached).  
5. **MoU & Compliance** – MoU status, reminders, expiry countdown.  
6. **Files & Documents** – PDFs, photos, forms.

**Health Formula (0–100):**
- Interaction Frequency (40%)
- Responsiveness (20%)
- Collaboration Quality (20%)
- MoU Status (20%)

Tiers:
🟢 Healthy 80–100 | 🟡 Needs Attention 60–79 | 🔴 At Risk <60

Auto-alerts trigger below 60.

Reusable: `<StakeholderProfileHeader/>`, `<InteractionTimeline/>`, `<ImpactSummaryCard/>`, `<MoUTracker/>`, `<DocumentLibrary/>`, `<HealthScoreBreakdown/>`

---

### Update – Edit School
- **Who:** EM (full), Vertical Chairs (their vertical), EC (interactions only).  
- **Validation:** School name + contact required.  
- **After Update:** log change; MoU update → add record; contact change → notify connected member.

---

### Interaction Logging (Critical)
Quick log form for any interaction:
- Type (Call, Meeting, Email, Session, MoU, etc.)
- Led by / Participants
- Outcome (Positive, Neutral, Negative, Pending)
- Notes (rich text)
- Attachments
- Next Follow-Up (optional)

After submit → timeline update, next reminder created.

Reusable: `<InteractionLogForm/>`, `<OutcomeSelector/>`, `<NextActionReminder/>`

---

## 2.3 Colleges CRM
Same as schools with additions:
- College Type, Affiliation, Student Strength, Departments.
- Yuva Chapter status and faculty contacts.
- Collaboration potentials (industrial visits, faculty speakers, volunteers).

Reuse all components from Schools CRM.

---

## 2.4 Industries CRM
### Fields
- Company Name, Sector, Address, Website, Employee Count.
- Key Contacts (CEO, CSR Manager, HR Head).
- Yi Member Connection (works there, alumni, client, friend).
- Collaboration: Industrial Visits, CSR, Sponsorship, Volunteering.
- CSR Profile: Budget, Focus Areas, Contact, Past Projects.
- Sponsorship Pipeline: Prospect → Active → Past.

Reusable: `<SponsorshipPipelineTracker/>`, `<CSRProfileCard/>`, `<EngagementHistoryList/>`

---

## 2.5 Government Stakeholders
Fields:
- Department, Official Name, Designation, Contact Info.
- Tenure: Join Date, Expected Transfer, Alert before transfer.
- Engagement: Past collaborations, interests, decision authority.
- Protocol: Preferred contact, lead time, formality, best time.

Transfer Alert System: Notifies 3 months before transfer.

Reusable: `<GovernmentProtocolCard/>`, `<TenureTracker/>`, `<TransferAlert/>`

---

## 2.6 NGO Partnerships
Fields:
- NGO Name, Focus Areas, Registration Info, Address, Contacts.
- Partnership Type: Joint Projects, Resource Sharing, Funding, Implementation, Advocacy.
- Past Collaborations (Project, Year, Outcome).
- Resource Sharing matrix.

Reusable: `<PartnershipTypeSelector/>`, `<ResourceSharingMatrix/>`, `<CollaborationHistoryList/>`

---

## 2.7 Vendor Management
Fields:
- Vendor Name, Category, Contact, Address, GST.
- Services, Capacity, Service Area, Pricing, Discounts, Payment Terms.
- Performance: Ratings, Delivery %, Quality %, Reliability.
- Engagement History: Events, Amount, Feedback.
- CII Approval Badge.

Reusable: `<VendorRatingCard/>`, `<PricingHistoryChart/>`, `<PerformanceTracker/>`, `<CIIApprovalBadge/>`

---

## 2.8 Speakers / Trainers Database
Fields:
- Name, Title, Organization, Contact, Photo.
- Expertise (Leadership, Entrepreneurship, Health, etc.).
- Bio, Past Topics, Achievements, Links.
- Availability, Notice Required, Fee Structure, Travel.
- Past Yi Engagements + Feedback + Media.

Reusable: `<SpeakerProfileCard/>`, `<AvailabilityCalendar/>`, `<FeeStructureCard/>`, `<PastEngagementList/>`

---

## 2.9 Cross-Stakeholder Features
### Unified Search
Search all types at once — categorized results.  
Reusable: `<UnifiedStakeholderSearch/>`

### Relationship Health Dashboard
Overall summary with traffic lights, action-needed list.
Reusable: `<RelationshipHealthDashboard/>`, `<ActionNeededList/>`

### Stakeholder Mapping
Geographic visualization of all stakeholders.  
Reusable: `<StakeholderMap/>`

### Bulk Operations
Select multiple: Send messages, log common interaction, export CSV, schedule follow-up.

---

## Data Relationships
```
Stakeholders → Schools, Colleges, Industries, Government, NGOs, Vendors, Speakers
Interactions → belong to Stakeholder, led by Member
MoUs → belong to Stakeholder
HealthScore → derived from Interactions
```

---

## Automation Triggers
- **MoU Expiry Alert:** 90 days before → notify vertical chair.  
- **Health Drop Alert:** score <60 → alert chair.  
- **No Interaction Alert:** >6 months → flag for follow-up.  
- **Follow-Up Reminder:** due today → notify member.  
- **Govt Transfer Alert:** 90 days before expected transfer.  
- **Vendor Issue Alert:** poor ratings twice → alert EM.

---

## Reusable Components Summary
**Forms:** `<StakeholderForm/>`, `<ContactRepeater/>`, `<MemberConnectionPicker/>`, `<MoUTracker/>`, `<FacilityChecklist/>`, `<CSRProfileCard/>`, `<GovernmentProtocolCard/>`, `<ResourceSharingMatrix/>`, `<VendorRatingCard/>`, `<SpeakerProfileCard/>`  
**Displays:** `<StakeholderCard/>`, `<StakeholderList/>`, `<StakeholderMap/>`, `<HealthScoreBadge/>`, `<InteractionTimeline/>`, `<ImpactSummaryCard/>`, `<DocumentLibrary/>`  
**Workflows:** `<InteractionLogForm/>`, `<OutcomeSelector/>`, `<NextActionReminder/>`, `<SponsorshipPipelineTracker/>`, `<TenureTracker/>`, `<TransferAlert/>`  
**Dashboards:** `<RelationshipHealthDashboard/>`, `<StakeholderMapView/>`, `<UnifiedStakeholderSearch/>`, `<BulkOperationToolbar/>`

---

_End of Module 2 – Stakeholder Relationship CRM_

