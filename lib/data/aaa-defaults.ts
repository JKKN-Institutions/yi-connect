/**
 * AAA Plan Default Suggestions
 *
 * Pre-populated suggestions for AAA plans based on Yi Erode Pathfinder 2026.
 * These are suggestions that EC members can edit or replace.
 *
 * @note These defaults are mapped by vertical slug (lowercase, hyphenated)
 */

export interface AAADefaults {
  // Awareness 1
  awareness_1_title: string
  awareness_1_description: string
  awareness_1_audience: string
  // Awareness 2
  awareness_2_title: string
  awareness_2_description: string
  awareness_2_audience: string
  // Awareness 3
  awareness_3_title: string
  awareness_3_description: string
  awareness_3_audience: string
  // Action 1
  action_1_title: string
  action_1_description: string
  action_1_target: string
  // Action 2
  action_2_title: string
  action_2_description: string
  action_2_target: string
  // Advocacy
  advocacy_goal: string
  advocacy_target_contact: string
  advocacy_approach: string
  // Milestones
  milestone_jan_target: string
  milestone_feb_target: string
  milestone_mar_target: string
}

/**
 * Map of vertical slugs to their AAA default suggestions
 */
export const aaaDefaults: Record<string, AAADefaults> = {
  // ============================================================================
  // MASOOM - Child Safety
  // ============================================================================
  masoom: {
    awareness_1_title: 'Yi S.E.N.S.E Module Session',
    awareness_1_description:
      'Safety, Emotional wellbeing, Navigating digital spaces, Seeking help, Empowerment - age-appropriate sessions explaining good touch/bad touch and personal safety.',
    awareness_1_audience: 'School Students (Thalir)',
    awareness_2_title: 'Digilante - Cyber Safety Workshop',
    awareness_2_description:
      'Cyber safety awareness including online predator identification, social media safety, and digital wellbeing for students.',
    awareness_2_audience: 'School and College Students',
    awareness_3_title: 'Parent Workshop - Child Safety Conversation',
    awareness_3_description:
      'Workshop for parents on "How to talk to your child about safety" covering CSA awareness and creating safe communication channels.',
    awareness_3_audience: 'Parents of School Students',
    action_1_title: 'MASOOM Model School Implementation',
    action_1_description:
      'Flagship implementation in 1-2 schools with comprehensive child safety curriculum, trained teachers, and ongoing support.',
    action_1_target: '200+ students per month (2 sessions/month)',
    action_2_title: 'SENSE via Yuva - College Student Facilitators',
    action_2_description:
      'Train college students to deliver SENSE modules in schools. Include 3 street play performances on child safety themes.',
    action_2_target: '3 skits performed, 500+ audience reached',
    advocacy_goal:
      'Partner with District Administration (DEO) for mandatory child safety education in all Erode schools. Advocate for POCSO awareness integration in school curriculum.',
    advocacy_target_contact: 'District Education Officer (DEO), District Collector',
    advocacy_approach:
      'Establish formal MOU with DEO for school access. Partner with Child Welfare Officers for session support. Engage local lawyers for POCSO legal clinics.',
    milestone_jan_target:
      'Connect with SRTN RM Yadhavi Yogesh. Schedule Train the Trainers certification for all EC. First 2 student sessions + member sensitization begins.',
    milestone_feb_target:
      '4 student sessions completed. Continue member sensitization. All EC members certified.',
    milestone_mar_target:
      '6 total student sessions (2/month cadence achieved). Q1 parent session conducted. Q1 rural MASOOM session completed.',
  },

  // ============================================================================
  // CLIMATE CHANGE
  // ============================================================================
  'climate-change': {
    awareness_1_title: 'Member Climate Awareness - Low Carbon Living',
    awareness_1_description:
      'Session for Yi members on responsible mobility, bring your own bottle, and practical low-carbon living tips for businesses.',
    awareness_1_audience: 'Yi Members',
    awareness_2_title: 'Campus Sustainability Audit Program',
    awareness_2_description:
      'Train Yuva students to conduct sustainability audits in their colleges. Create campus climate champions.',
    awareness_2_audience: 'College Students (Yuva)',
    awareness_3_title: 'Rural Water Conservation Session',
    awareness_3_description:
      'Community session on water conservation, organic farming benefits, and climate adaptation for rural communities.',
    awareness_3_audience: 'Rural Communities and Farmers',
    action_1_title: 'Afforestation Drive - 5000 Trees',
    action_1_description:
      'Monthly plantation drives targeting 400+ trees each. Include seed ball making with Thalir and Yuva students.',
    action_1_target: '5,000 trees planted in Erode district',
    action_2_title: 'Water Warriors - Cleanup and Rejuvenation',
    action_2_description:
      'Cauvery banks, local ponds, and temple tank cleanup drives. Partner with panchayats for 2 water body rejuvenation projects.',
    action_2_target: '5 cleanup drives + 2 rejuvenation projects',
    advocacy_goal:
      'Establish Green Torch Chapter standard - all Yi events to be plastic-free and zero-waste. Advocate for corporate e-waste collection at member businesses.',
    advocacy_target_contact: 'District Administration, Forest Department, Municipal Corporation',
    advocacy_approach:
      'Secure land and saplings from Forest Department. Get municipal permissions for water body access. Partner with textile mills for e-waste collection.',
    milestone_jan_target:
      'Connect with SRTN RM Prasanth Ram. Identify e-waste recycling partner. First awareness session. First plantation (500 trees).',
    milestone_feb_target:
      '2nd plantation drive. 2 awareness sessions. Identify water bodies for cleanup.',
    milestone_mar_target:
      '3rd plantation drive. First water cleanup. Heritage site identified for My City My Pride.',
  },

  // ============================================================================
  // ROAD SAFETY
  // ============================================================================
  'road-safety': {
    awareness_1_title: 'Chota Cop Training - Road Rules for Children',
    awareness_1_description:
      'Report card-based learning system teaching road rules to children. Digital data capture for every child trained.',
    awareness_1_audience: 'School Students (Thalir)',
    awareness_2_title: 'Good Samaritan Law Awareness',
    awareness_2_description:
      'Legal protection awareness for those who help accident victims. Farishtey certification program for first responders.',
    awareness_2_audience: 'Members, Yuva, General Public',
    awareness_3_title: 'Helmet and Seat Belt Safety Campaign',
    awareness_3_description:
      'Two-wheeler and four-wheeler safety campaigns targeting high-risk areas near NH544 and industrial zones.',
    awareness_3_audience: 'General Public, Industrial Workers',
    action_1_title: 'Chota Cop School Sessions',
    action_1_description:
      'Systematic rollout across Erode schools with digital report cards tracking every child. Partner with traffic police.',
    action_1_target: '25,000 students trained as Chota Cops',
    action_2_title: 'EMRI First Responder Training',
    action_2_description:
      'Emergency first responder training at member offices and colleges. Certify Farishtey first responders.',
    action_2_target: '100+ Farishtey certified first responders',
    advocacy_goal:
      'Partner with Erode RTO and District Traffic Police for joint awareness campaigns. Advocate for mandatory road safety education in school curriculum.',
    advocacy_target_contact: 'Erode RTO, District Traffic Police, Transport Department',
    advocacy_approach:
      'Joint campaigns with RTO. Yuva traffic management with traffic police. Press coverage in The Hindu Young World.',
    milestone_jan_target:
      'Road Safety Week (Jan 26-31) execution - minimum 5 events. Social media campaigns. Rallies with Transport Dept.',
    milestone_feb_target: 'Begin systematic Chota Cop rollout. Target 5,000 students.',
    milestone_mar_target:
      'Continue rollout (10,000 cumulative). First Farishtey training batch completed.',
  },

  // ============================================================================
  // HEALTH
  // ============================================================================
  health: {
    awareness_1_title: 'Member Mental Wellness Workshop',
    awareness_1_description:
      'Understanding stress, work-life balance, and self-care for Yi members. Breaking the stigma on mental health discussions.',
    awareness_1_audience: 'Yi Members',
    awareness_2_title: 'Yuva Life Skills Training',
    awareness_2_description:
      'Empathy, self-awareness, interpersonal communication, and peer support training for college students.',
    awareness_2_audience: 'College Students (Yuva)',
    awareness_3_title: 'Rural Mental Health Session',
    awareness_3_description:
      'Community sessions on mental health basics, breaking taboos around seeking help, and identifying warning signs.',
    awareness_3_audience: 'Rural Communities',
    action_1_title: 'NIMHANS Train the Trainers Certification',
    action_1_description:
      'Member certification through NIMHANS partnership (Feb 2026). Create certified mental health advocates.',
    action_1_target: '5+ members NIMHANS ToT certified',
    action_2_title: 'Run for Mental Health',
    action_2_description:
      'Flagship community run event during Health Week (August). Public engagement and awareness on mental wellness.',
    action_2_target: '500+ participants in Run for Mental Health',
    advocacy_goal:
      'Partner with NIMHANS and UNICEF for sustained mental health programs. Advocate for workplace mental health policies in member companies.',
    advocacy_target_contact: 'NIMHANS, District Mental Health Program, Corporate HR Leaders',
    advocacy_approach:
      'NIMHANS ToT sessions launching Feb 2026. Connect with District Mental Health Program. Partner with local counselors for referrals.',
    milestone_jan_target:
      'Identify member ToT candidates. Plan Yuva college rollout. Connect with national team for NIMHANS ToT registration.',
    milestone_feb_target:
      'Participate in NIMHANS ToT launch (Week 2). Begin Yuva Life Skills Training in 2 pilot colleges.',
    milestone_mar_target: 'First rural mental health session. Scale Yuva to 5 colleges.',
  },

  // ============================================================================
  // MEMBERSHIP
  // ============================================================================
  membership: {
    awareness_1_title: 'Yi Impact Showcase - Monthly Spotlights',
    awareness_1_description:
      'Monthly social media spotlights on member achievements and transformation stories through Yi.',
    awareness_1_audience: 'Public, Potential Members',
    awareness_2_title: 'Business Leader Breakfast - Prospect Networking',
    awareness_2_description:
      'Quarterly networking events for business leaders aged 25-45. Showcase Yi value proposition.',
    awareness_2_audience: 'Business Owners, Entrepreneurs, Professionals',
    awareness_3_title: 'Member Testimonial Series',
    awareness_3_description:
      'Video stories of transformation through Yi. Highlight how membership creates business and personal growth.',
    awareness_3_audience: 'Public, Inactive Members',
    action_1_title: 'Bring Your Partner Drive',
    action_1_description:
      'Targeted couple membership drive. Personal outreach to all members for renewals and new couple inductees.',
    action_1_target: '10 couple memberships by Feb 15',
    action_2_title: 'Female Founder Focus Initiative',
    action_2_description:
      'Targeted outreach to women entrepreneurs in textiles, healthcare, and education sectors.',
    action_2_target: '5 new women entrepreneur inductees',
    advocacy_goal:
      'Position Yi membership as essential business credential. Explore satellite chapter model for Gobichettipalayam and Bhavani expansion.',
    advocacy_target_contact: 'CII Erode (Gunananthan - 9791005881), Local Business Associations',
    advocacy_approach:
      'Formal CII partnership for joint programs. Industry vertical outreach (textiles, healthcare, education). Dual membership option promotion.',
    milestone_jan_target:
      'Member database audit complete. All renewal calls made. Inactive members contacted.',
    milestone_feb_target:
      '90% renewals processed by Feb 15. First prospect event executed.',
    milestone_mar_target:
      '100% renewal + 5 new inductees. Female member ratio improved by 10%.',
  },

  // ============================================================================
  // YUVA
  // ============================================================================
  yuva: {
    awareness_1_title: 'Campus Ambassador Program Launch',
    awareness_1_description:
      'Train 100 student leaders as Yi advocates. Monthly social media featuring Yuva impact stories.',
    awareness_1_audience: 'College Students',
    awareness_2_title: 'College Dean Connect - Leadership Briefings',
    awareness_2_description:
      'Quarterly briefings to academic leadership on Yi Yuva programs and student development opportunities.',
    awareness_2_audience: 'College Deans, Principals',
    awareness_3_title: 'Career Catalyst Sessions',
    awareness_3_description:
      'Sessions linking Yuva students to member mentorship. Career guidance and industry exposure.',
    awareness_3_audience: 'Final Year Students',
    action_1_title: 'New College MOU Drive',
    action_1_description:
      'Expand Yuva network from 35 to 50 colleges. Focus on engineering, arts & science, pharmacy institutions.',
    action_1_target: '15 new college MOUs by June 2026',
    action_2_title: 'MASOOM Street Plays by Yuva',
    action_2_description:
      'College students perform 3+ street plays annually on child safety themes. Integrate with MASOOM vertical.',
    action_2_target: '3 performances, 1,500+ combined audience',
    advocacy_goal:
      'Advocate for academic credit for Yi Yuva participation aligned with NEP 2020. Explore Yuva Utkarsh Centre of Excellence in Erode.',
    advocacy_target_contact: 'University Registrars, AICTE, Local College Principals',
    advocacy_approach:
      'Policy advocacy for student representation in district planning. Industry advocacy for internship pipeline through member companies.',
    milestone_jan_target:
      'Campus Ambassador selection (20 students). 5 new college MOUs signed.',
    milestone_feb_target: 'First MASOOM street play performed. Continue MOU drive.',
    milestone_mar_target:
      '40,000 registered Yuva (10% growth). Road Safety Champions program launched.',
  },

  // ============================================================================
  // THALIR
  // ============================================================================
  thalir: {
    awareness_1_title: 'Democracy 101 - Civic Education Module',
    awareness_1_description:
      'Civic education module launch in all schools. Pre-YIP quiz on parliamentary and civic knowledge.',
    awareness_1_audience: 'School Students',
    awareness_2_title: 'YIP Roadshow - Parliament Awareness',
    awareness_2_description:
      'Young Indians Parliament awareness campaigns in target schools. Principal Connect quarterly briefings.',
    awareness_2_audience: 'Schools, School Leaders',
    awareness_3_title: 'Parent Sabha - Community Awareness',
    awareness_3_description:
      'Community awareness sessions for parents on YIP, Yi Young Champions booklets, and school programs.',
    awareness_3_audience: 'Parents',
    action_1_title: 'Young Indians Parliament (YIP) Chapter Round',
    action_1_description:
      'Host YIP Chapter Round with 500+ student participants. Pathway: Chapter -> Regional -> National Finals.',
    action_1_target: '500+ students in YIP Chapter Round',
    action_2_title: 'Yi Young Champions Booklet Distribution',
    action_2_description:
      'Distribute 2 Yi Young Champions booklets covering all 8 verticals to 3,000 students across 75 schools.',
    action_2_target: '3,000 copies across 75 schools',
    advocacy_goal:
      'Partner with DEO for government school access. Advocate for YIP modules alignment with NEP 2020 civics curriculum.',
    advocacy_target_contact: 'District Education Officer, Government School Principals',
    advocacy_approach:
      'Establish DEO partnership. Quality documentation for national policy impact. IP protection for YIP program.',
    milestone_jan_target:
      '10 new school MOUs (61 total). Yi Young Champions Booklet 1 launch. DEO meeting scheduled.',
    milestone_feb_target:
      'Thalir National Week (Feb 9-15) - Booklet 1 rollout to 20 schools. YIP awareness in all schools.',
    milestone_mar_target:
      'Booklet 2 launch (BEW Mar 5-11). YIP prep complete. Yi AI Innovation Labs partner school onboarding begins.',
  },

  // ============================================================================
  // RURAL INITIATIVE
  // ============================================================================
  'rural-initiative': {
    awareness_1_title: 'Village Sabha - Yi Introduction Sessions',
    awareness_1_description:
      'Introduction sessions in target panchayats (Kodumudi, Modakkurichi, Nambiyur, Anthiyur). Identify local leaders.',
    awareness_1_audience: 'Panchayat Members, Village Leaders',
    awareness_2_title: 'SHG Connect - Women\'s Group Awareness',
    awareness_2_description:
      'Awareness sessions with Self-Help Groups in handloom, agriculture, and craft sectors.',
    awareness_2_audience: 'Women\'s Self-Help Groups',
    awareness_3_title: 'Artisan Stories - Digital Feature Series',
    awareness_3_description:
      'Social media series featuring rural craftspeople - handloom weavers, pottery, bamboo craft artisans.',
    awareness_3_audience: 'Public, Urban Members',
    action_1_title: 'Range De - Eco-friendly Holi Campaign',
    action_1_description:
      'Eco-friendly Holi colors sourced from rural SHGs. National campaign celebrating rural entrepreneurship.',
    action_1_target: '500+ rural participants in Range De',
    action_2_title: 'Rural Bazaar - SHG Products Showcase',
    action_2_description:
      'Market linkage event during RI Week showcasing SHG products. Connect rural artisans to member businesses.',
    action_2_target: '10 SHG/artisan products showcased',
    advocacy_goal:
      'Connect artisans to government schemes (PM Vishwakarma). Advocate for rural products in Yi events and member businesses.',
    advocacy_target_contact: 'District Collector, Panchayat Leaders, Rural Development Office',
    advocacy_approach:
      'Policy advocacy for artisan scheme enrollment. Market advocacy through Yi events. Heritage documentation for 2 rural sites.',
    milestone_jan_target:
      'Connect with SRTN RM Mohan Kumar. 3 target villages/panchayats identified.',
    milestone_feb_target:
      'Community leaders identified in each target. First village engagement completed.',
    milestone_mar_target:
      'Range De campaign executed (Mar 14). 2 rural networks acquired. 1 MASOOM rural session done.',
  },

  // ============================================================================
  // ENTREPRENEURSHIP
  // ============================================================================
  entrepreneurship: {
    awareness_1_title: 'BEW Launch Event - Entrepreneur Panel',
    awareness_1_description:
      'Kickoff event with successful entrepreneur panel during Bharat Entrepreneurship Week (Mar 5-11).',
    awareness_1_audience: 'Members, Public',
    awareness_2_title: 'Kidpreneur Orientation in Schools',
    awareness_2_description:
      'Introduce entrepreneurship concepts to Classes 6-9. Prepare schools for Kidpreneur program.',
    awareness_2_audience: 'School Students (Thalir)',
    awareness_3_title: 'BBIC Campus Roadshows',
    awareness_3_description:
      'Bharat Billion Impact Challenge awareness campaigns at 5 colleges for Yuva startup teams.',
    awareness_3_audience: 'College Students (Yuva)',
    action_1_title: 'Bharat Entrepreneurship Week (BEW) Activities',
    action_1_description:
      'Full week of startup showcases, pitch sessions, and networking events (Mar 5-11).',
    action_1_target: '5+ BEW activities executed',
    action_2_title: 'Kidpreneur Program Execution',
    action_2_description:
      'Rs. 1,000 seed capital per child. Week-long entrepreneurship exercise in 3 schools, 30 kids.',
    action_2_target: '30 Kidpreneurs from 3 schools',
    advocacy_goal:
      'Partner with IIT Madras incubation ecosystem (Pratham + Akshar) for Yuva exposure. Include Yi in district skill development committee.',
    advocacy_target_contact:
      'Erode Industrial Association, Local Banks (SBI/Indian Bank), District Collector',
    advocacy_approach:
      'Mentorship pool from Industrial Association. Seed funding sponsorship from banks. Government scheme awareness for rural entrepreneurs.',
    milestone_jan_target:
      'Connect with SRTN RM Neil Kikani. Finalize 3 Kidpreneur schools.',
    milestone_feb_target:
      'Secure seed capital sponsorship. BEW event plan approved.',
    milestone_mar_target:
      'Kidpreneur teacher training. BEW Week execution (Mar 5-11). Kidpreneur program launched.',
  },

  // ============================================================================
  // INNOVATION
  // ============================================================================
  innovation: {
    awareness_1_title: 'IDS 6 Orientation Webinar',
    awareness_1_description:
      'Innovation Development Series 6 launch (Feb 2). Explain IDS format, how to participate, and form teams.',
    awareness_1_audience: 'College Students (Yuva)',
    awareness_2_title: 'Yi AI Innovation Labs Problem Statement Reveal',
    awareness_2_description:
      'National challenge announcement for schools. Activity book distribution for Thalir InnovX.',
    awareness_2_audience: 'School Students (Thalir)',
    awareness_3_title: 'AI for Yi - Member AI Literacy',
    awareness_3_description:
      'Sessions on what AI can do for your business. Practical AI applications for members.',
    awareness_3_audience: 'Yi Members',
    action_1_title: 'IDS 6 Hackathon',
    action_1_description:
      '2-day Think-Ideate-Build-Test cycle followed by mentor-guided pilot phase. Submit team to national competition.',
    action_1_target: '1 IDS 6 team to national competition',
    action_2_title: 'Yi AI Innovation Labs in Schools',
    action_2_description:
      'Two-track model: Track 1 (Activity) = Monthly AI sessions + certificates. Track 2 (Partner) = Track 1 + Computer lab rebranding.',
    action_2_target: '25+ schools (10 Partner + 15 Activity Track)',
    advocacy_goal:
      'Partner with District Industries Centre for innovation scheme awareness. Include youth innovators in district science fair judging.',
    advocacy_target_contact: 'District Industries Centre, Engineering Colleges, Government Schools',
    advocacy_approach:
      'Engineering college pipeline for IDS teams. Government schools for Yi AI Innovation Labs. Rural SHGs for Rural Jugaad innovators.',
    milestone_jan_target:
      'Connect with SRTN RM Jothi. Identify IDS 6 team from chapter.',
    milestone_feb_target:
      'IDS 6 registration complete. Problem statement selection. Hackathon execution begins.',
    milestone_mar_target:
      'Yi AI Innovation Labs Launch (BEW Mar 5-11). Partner School onboarding. IDS 6 pilot phase.',
  },

  // ============================================================================
  // LEARNING
  // ============================================================================
  learning: {
    awareness_1_title: 'Yi Talks Monthly Calendar Announcement',
    awareness_1_description:
      'Announce full year speaker lineup. Monthly expert sessions on leadership, business, and personal development.',
    awareness_1_audience: 'Yi Members',
    awareness_2_title: 'CEO Mission Promotion',
    awareness_2_description:
      'Promote CEO Leadership Mission program - what it is, who should go, and transformational benefits.',
    awareness_2_audience: 'Senior Members',
    awareness_3_title: 'Inner Circle Concept Launch',
    awareness_3_description:
      'Peer learning groups of 8-10 members based on industry or interest. Explain format and benefits.',
    awareness_3_audience: 'Yi Members',
    action_1_title: 'Inner Circle Formation',
    action_1_description:
      'Launch 3 Inner Circles based on industry/interest. Regular peer learning sessions throughout the year.',
    action_1_target: '3 Inner Circles with 8-10 members each',
    action_2_title: 'Yuva Internship Matching Program',
    action_2_description:
      'Match Yuva students with internship opportunities in member organizations. Real-world experience.',
    action_2_target: '10 internships facilitated',
    advocacy_goal:
      'Partner with District Employment Office for Yuva skill certification. Cross-chapter missions with YiBE sessions.',
    advocacy_target_contact: 'Erode Chamber of Commerce, Local Institutions, Master Union (Yi Network)',
    advocacy_approach:
      'Industry visit coordination with Chamber of Commerce. Speaker connections through Master Union. Bank partnerships for rural financial literacy.',
    milestone_jan_target:
      'Connect with SRTN RM Yokesh. Form 3 Inner Circles. First Yi Talks executed.',
    milestone_feb_target:
      'Yuva internship opportunities listed. CEO Mission members identified.',
    milestone_mar_target: '10 internships matched. Inner Circles active. 3 Yi Talks completed.',
  },
}

/**
 * Get AAA defaults for a vertical by slug or name
 *
 * @param verticalSlug - The slug of the vertical (e.g., 'masoom', 'climate-change')
 * @param verticalName - The display name as fallback (e.g., 'MASOOM', 'Climate Change')
 * @returns The AAA defaults for the vertical, or undefined if not found
 */
export function getAAADefaults(
  verticalSlug?: string,
  verticalName?: string
): AAADefaults | undefined {
  if (!verticalSlug && !verticalName) return undefined

  // Try exact slug match first
  if (verticalSlug) {
    const slugLower = verticalSlug.toLowerCase()
    if (aaaDefaults[slugLower]) {
      return aaaDefaults[slugLower]
    }
  }

  // Try to match by name (convert to slug format)
  if (verticalName) {
    const nameSlug = verticalName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    if (aaaDefaults[nameSlug]) {
      return aaaDefaults[nameSlug]
    }

    // Try some common variations
    const variations = [
      nameSlug,
      nameSlug.replace(/-/g, ''),
      verticalName.toLowerCase(),
    ]

    for (const variant of variations) {
      for (const key of Object.keys(aaaDefaults)) {
        if (key === variant || key.includes(variant) || variant.includes(key)) {
          return aaaDefaults[key]
        }
      }
    }
  }

  return undefined
}
