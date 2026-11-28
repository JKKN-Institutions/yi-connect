/**
 * Yi Erode EC 2027 EOI: role catalogue and commitments.
 *
 * GENERATED from "Yi Erode EOI - Website Design.html" (Sharabhesh, 17 Nov 2026)
 * by an extraction script; wording is copied, never retyped. Do not edit the
 * text here without the chapter's okay.
 *
 * STABLE IDS: each role keeps its id forever. The id is written into every
 * saved proposal, so reordering or renaming a role must never change its id.
 * The ids match the design's vertical-0..vertical-13 so imported prototype
 * data maps 1:1. This file has no imports so it runs under plain node tests.
 */

export type EoiCategory = 'Stakeholders' | 'Projects' | 'Initiatives'

export interface EoiRole {
  id: string
  category: EoiCategory
  name: string
  description: string
  responsibilities: { title: string; text: string }[]
  flagship?: { label: string; title: string; date: string; description: string }
}

export interface EoiCommitment {
  title: string
  icon: string
  schedule: string
  format: string
  description: string
}

export const EOI_TEAM_YEAR = '2027'

/** Bump when the commitment wording members accept changes. */
export const EOI_COMMITMENT_VERSION = '2026-11-17'

export const EOI_ROLE_UPDATE_NOTE =
  'Any new programmes or responsibilities introduced for 2027 will be shared with you when you take up this role, with further guidance during Pathfinder and the EC Leader Academy (EC LA).'

export const EOI_ROLES: readonly EoiRole[] = [
  {
    "id": "vertical-0",
    "category": "Stakeholders",
    "name": "Membership",
    "description": "Build an active, connected member community where every Yi Erode member feels welcome and involved.",
    "responsibilities": [
      {
        "title": "Member engagement",
        "text": "Plan regular opportunities to connect, including dinners, movie nights, and group trips."
      },
      {
        "title": "Collaboration across verticals",
        "text": "Coordinate member-focused activities with other verticals and respond to their proposals for member participation. Examples include sessions with Learning, industrial visits with Entrepreneurship, and sapling planting with Climate Change."
      },
      {
        "title": "Cross-chapter connections",
        "text": "Create opportunities to exchange ideas and collaborate with members from other Yi chapters."
      },
      {
        "title": "Welcoming new members",
        "text": "Help new members settle into the chapter, build relationships, and find meaningful ways to participate."
      }
    ]
  },
  {
    "id": "vertical-1",
    "category": "Stakeholders",
    "name": "Thalir",
    "description": "Connect Yi Erode with its partner schools and create meaningful opportunities for school students to learn, participate, and lead.",
    "responsibilities": [
      {
        "title": "School coordination",
        "text": "Serve as the primary point of contact between Yi Erode and Thalir schools. Coordinate activities proposed by Yi verticals, and connect requests from schools with the appropriate teams."
      },
      {
        "title": "Collaborative programmes",
        "text": "Possible collaborations include road-safety sessions with Road Safety, age-appropriate child-safety awareness with Masoom, and environmental activities with Climate Change."
      },
      {
        "title": "School partnerships",
        "text": "Track existing MoUs and renew those approaching expiry through the online renewal process. Expand the network by bringing new schools on board through new MoUs."
      }
    ],
    "flagship": {
      "label": "FLAGSHIP EVENT",
      "title": "Young Indians Parliament",
      "date": "Chapter round · Tentatively late July or the first week of August 2027",
      "description": "Lead the Thalir flagship event, coordinating planning and participation with the schools and chapter team."
    }
  },
  {
    "id": "vertical-2",
    "category": "Stakeholders",
    "name": "Yuva",
    "description": "Connect Yi Erode with Yuva colleges and help students turn learning, ideas, and leadership into practical action.",
    "responsibilities": [
      {
        "title": "College coordination",
        "text": "Serve as the primary point of contact between Yi Erode and Yuva colleges. Coordinate programmes offered by Yi verticals and route requests from colleges to the relevant teams."
      },
      {
        "title": "Collaborative programmes",
        "text": "Possible collaborations include founder interactions with Entrepreneurship, problem-solving workshops with Innovation, and skill-building sessions with Learning."
      },
      {
        "title": "College partnerships",
        "text": "Track existing MoUs and complete online renewals before they expire. Grow the Yuva network by enrolling new colleges through new MoUs."
      }
    ],
    "flagship": {
      "label": "FLAGSHIP EVENT",
      "title": "Future7.0",
      "date": "Chapter round · Tentatively mid-August 2027",
      "description": "Lead the Yuva flagship event, coordinating preparations and college participation with the chapter team."
    }
  },
  {
    "id": "vertical-3",
    "category": "Stakeholders",
    "name": "Rural Initiatives",
    "description": "Bring Yi’s programmes closer to rural communities and support locally driven, lasting development.",
    "responsibilities": [
      {
        "title": "Community coordination",
        "text": "Connect Yi verticals with rural communities for relevant activities. Gather requests from residents and participating institutions, and coordinate support from the appropriate teams."
      },
      {
        "title": "Collaborative programmes",
        "text": "Possible collaborations include environmental awareness and sapling planting with Climate Change, health-awareness sessions with Health, and practical learning sessions with Learning."
      },
      {
        "title": "Local participation",
        "text": "Work closely with the village’s group of young people to understand priorities and shape awareness and learning sessions around community needs."
      }
    ],
    "flagship": {
      "label": "YOUR FOCUS",
      "title": "Yi Rural Hub · A. Hanumanpalli",
      "date": "Launched in 2026 · Ongoing initiative",
      "description": "Lead the hub’s work towards a self-sustaining model village, in collaboration with local young people and Yi’s vertical teams."
    }
  },
  {
    "id": "vertical-4",
    "category": "Projects",
    "name": "Health",
    "description": "Promote mental wellbeing, substance-abuse prevention, and healthier everyday choices across Yi Erode’s schools, colleges, member community, and rural initiatives.",
    "responsibilities": [
      {
        "title": "Awareness for Thalir and Yuva",
        "text": "Organise age-appropriate sessions on mental health and drug-abuse prevention for school and college students, in coordination with the Thalir and Yuva teams and relevant experts."
      },
      {
        "title": "Wellbeing for members and rural communities",
        "text": "Work with Membership and Rural Initiatives to plan engaging health activities, such as nutrition, balanced-diet, and healthy-habit challenges, with appropriate expert guidance."
      },
      {
        "title": "Expand student-led outreach",
        "text": "Extend Mission on Smart Choices to more Thalir schools. Partner with additional Yuva colleges and coordinate training for more student facilitators to build a larger team capable of reaching more children."
      }
    ],
    "flagship": {
      "label": "YI ERODE INITIATIVE",
      "title": "Mission on Smart Choices",
      "date": "In collaboration with Manathin Maiyam",
      "description": "Building on Yi Erode’s existing initiative, in which Dr. Jayaprakash trained a group of Yuva students to deliver mental-health and drug-abuse awareness sessions for Thalir schoolchildren, lead the next phase of school outreach and student-facilitator development."
    }
  },
  {
    "id": "vertical-5",
    "category": "Projects",
    "name": "Road Safety",
    "description": "Encourage safer road habits and build awareness of emergency response and support for road-accident victims through programmes for students, members, workplaces, and transport communities.",
    "responsibilities": [
      {
        "title": "Chota Cop · Thalir schools",
        "text": "Arrange road-safety awareness sessions with Yi members, covering basic traffic rules. Coordinate school visits to the Olirum Erode Foundation’s road safety park where appropriate. Give students a report card to observe their family’s adherence to traffic rules over one week, encouraging safer habits at home. Include awareness of Good Samaritan protections."
      },
      {
        "title": "EMRI sessions · Colleges and communities",
        "text": "Coordinate EMRI sessions through Yi’s tie-up with the GVK group, which provides facilitators. Work with Yuva colleges, the member community, companies, and transport groups to organise sessions for their students, members, employees, or personnel."
      },
      {
        "title": "Farishtey · Awareness that encourages assistance",
        "text": "Organise sessions for Yuva students, Yi members, company employees, transport personnel, and other relevant groups. Build awareness of the Good Samaritan law and the legal protections it provides to bystanders who assist road-accident victims."
      }
    ]
  },
  {
    "id": "vertical-6",
    "category": "Projects",
    "name": "Masoom",
    "description": "Help create safer environments for children and adolescents in Erode through age-appropriate awareness, trained facilitators, and active involvement from schools, families, and communities.",
    "responsibilities": [
      {
        "title": "Build your ability to deliver sessions",
        "text": "Complete the Masoom Train the Trainers programme and certification through the designated training partners. Coordinate trained facilitators to deliver consistent, sensitive awareness sessions."
      },
      {
        "title": "Child and adolescent awareness",
        "text": "Work with Thalir schools to arrange body ownership and child sexual abuse awareness for children up to Grade 6, and the Let’s Talk module for Grade 7 onwards. Include Digilante sessions on digital safety and responsible online behaviour."
      },
      {
        "title": "Engage parents, members, and rural communities",
        "text": "Organise awareness sessions for parents, guardians, educators, and Yi members, including new members, on child safety and the Protection of Children from Sexual Offences (POCSO) framework. Extend suitable awareness and digital-safety programmes to rural communities."
      },
      {
        "title": "Mobilise Yuva volunteers",
        "text": "Coordinate with Yuva colleges to organise skits, street plays, competitions, and pledge activities that help communities understand child safety and shared responsibility."
      }
    ],
    "flagship": {
      "label": "SCHOOL PARTNERSHIP",
      "title": "Masoom Model School",
      "date": "A sustained approach to child safety",
      "description": "Work with participating schools to bring together child and adolescent sessions, parent engagement, educator sensitisation, and digital-safety activities as an ongoing programme."
    }
  },
  {
    "id": "vertical-7",
    "category": "Projects",
    "name": "Sense",
    "description": "Build civic responsibility among Thalir school students and Yuva college students. Work with both teams to organise age-appropriate sessions and practical activities that encourage considerate behaviour in everyday life.",
    "responsibilities": [
      {
        "title": "Public etiquette and respect",
        "text": "Help students practise respectful behaviour in shared spaces, including orderly queues, considerate use of phones and audio, keeping pathways clear, and showing courtesy to others."
      },
      {
        "title": "Care for shared spaces",
        "text": "Plan awareness activities on preventing litter, separating waste, conserving water and electricity, and protecting greenery. Encourage students to apply these habits in their schools, colleges, and neighbourhoods."
      },
      {
        "title": "Responsible commuting",
        "text": "Use everyday travel situations to discuss offering priority seats, letting passengers exit before boarding, keeping entrances clear, respecting pedestrians, and using helmets and seatbelts. Coordinate with Road Safety where relevant."
      },
      {
        "title": "Digital citizenship",
        "text": "Organise discussions on checking information before sharing, responding to cyberbullying, respecting personal privacy, and seeking consent before posting someone’s photograph. Encourage students to be considerate both online and offline."
      }
    ]
  },
  {
    "id": "vertical-8",
    "category": "Projects",
    "name": "Climate Change",
    "description": "Bring members, Thalir schools, Yuva colleges, and rural communities together for practical environmental action in Erode. Coordinate local partners and track the progress of activities beyond the event itself.",
    "responsibilities": [
      {
        "title": "Afforestation and awareness",
        "text": "Organise climate-awareness sessions, sapling planting, and seed-ball activities. Work with institutions, corporate supporters, and local authorities to identify suitable sites and arrange saplings, with a plan for ongoing care."
      },
      {
        "title": "Water Warriors",
        "text": "Coordinate water-body clean-up and restoration efforts with community groups, NGOs, and the relevant authorities. Encourage awareness of water conservation and local ownership of ponds, lakes, and other water resources."
      },
      {
        "title": "E-waste and everyday sustainability",
        "text": "Arrange e-waste collection drives with suitable recycling partners. Promote waste segregation, composting, reuse, and recycling, and help Yi Erode events adopt practices that reduce plastic, paper, and waste."
      },
      {
        "title": "Reviving Roots",
        "text": "Engage Thalir and Yuva in heritage walks, creative reuse workshops, and clean-up activities around local heritage. Explore adopting a suitable site with the relevant authorities and partners to support its upkeep."
      }
    ]
  },
  {
    "id": "vertical-9",
    "category": "Initiatives",
    "name": "Entrepreneurship",
    "description": "Help Yi Erode members, students, and rural entrepreneurs develop business ideas, build useful connections, and access opportunities for growth.",
    "responsibilities": [
      {
        "title": "Business mentoring · Members and Yuva",
        "text": "Coordinate YiBE discussions to help members address business challenges and guide students in turning early ideas into structured startup plans. Bring in suitable mentors and business practitioners."
      },
      {
        "title": "Kidpreneur · Thalir schools",
        "text": "Work with Thalir to introduce entrepreneurship and money-management skills through practical business exercises. Arrange factory visits that help students understand how businesses operate."
      },
      {
        "title": "Careers and startup opportunities · Yuva",
        "text": "Organise Naukri Bazaar to connect students with employers, career guidance, and verified job opportunities. Support participation in the Bharat Billion Impact Challenge through mentoring, business-plan preparation, and pitch practice."
      },
      {
        "title": "Rural enterprise and livelihoods",
        "text": "Collaborate with Rural Initiatives on rural bazaars and mentoring opportunities that help local entrepreneurs develop their ventures and reach customers."
      }
    ],
    "flagship": {
      "label": "KEY PROGRAMMES",
      "title": "Bharat Entrepreneurship Week & YiFi",
      "date": "Chapter activities · National participation",
      "description": "Coordinate local activities for Bharat Entrepreneurship Week across the stakeholder groups. Encourage members, Yuva students, and rural entrepreneurs to participate in YiFi for business learning, finance insights, and networking."
    }
  },
  {
    "id": "vertical-10",
    "category": "Initiatives",
    "name": "Innovation",
    "description": "Help Erode’s members, students, and rural communities turn local challenges into practical ideas, prototypes, and solutions.",
    "responsibilities": [
      {
        "title": "Innovation exposure · Members",
        "text": "Arrange learning experiences and curated innovation visits that introduce members to new approaches, technologies, and practical applications."
      },
      {
        "title": "Local problem-solving · Yuva",
        "text": "Identify a real challenge in Erode and bring together college teams, Yi members, and expert mentors through Ideate, Define, Showcase (IDS). Build college innovation clubs, coordinate with relevant local authorities, and support pilots with documented feedback."
      },
      {
        "title": "InnovX · Thalir schools",
        "text": "Coordinate innovation-mindset activities for students in Classes 4–9. Support classroom experiments, document students’ attempts, and prepare school teams to showcase their work at a city-level InnovX summit."
      },
      {
        "title": "Rural innovators",
        "text": "Work with Rural Initiatives to identify local talent and connect promising ideas with mentors who can help develop prototypes."
      }
    ],
    "flagship": {
      "label": "KEY PROGRAMME",
      "title": "Innovation Week",
      "date": "Bring all four stakeholder groups together",
      "description": "Plan a mix of AI learning, design-thinking and prototyping workshops, mentoring sessions, and local innovator discussions, with activities suited to members, Yuva, Thalir, and rural communities."
    }
  },
  {
    "id": "vertical-11",
    "category": "Initiatives",
    "name": "Learning",
    "description": "Create a regular calendar of engaging learning sessions for Thalir students, Yuva students, Yi members, and rural communities in Erode.",
    "responsibilities": [
      {
        "title": "Plan for each audience",
        "text": "Work with the stakeholder teams to understand their interests and learning needs. Choose relevant topics and formats, from student life skills and career conversations to member development and practical community learning."
      },
      {
        "title": "Bring in engaging speakers",
        "text": "Identify and invite knowledgeable speakers, practitioners, and subject experts regularly. Brief them on the audience so each session is accessible, interesting, and useful."
      },
      {
        "title": "Coordinate and improve sessions",
        "text": "Collaborate with other verticals on suitable topics, manage session arrangements with the host team, and encourage participation. Gather feedback to shape future topics and speakers."
      }
    ]
  },
  {
    "id": "vertical-12",
    "category": "Initiatives",
    "name": "Sports",
    "description": "Encourage regular participation in sport among Yi members, school students, and college students in Erode through friendly activities and well-organised tournaments.",
    "responsibilities": [
      {
        "title": "Build a regular sports calendar",
        "text": "Arrange activities across different sports for members, Thalir schools, and Yuva colleges. Work with the respective teams to choose suitable venues and formats that welcome different levels of ability."
      },
      {
        "title": "Organise local tournaments",
        "text": "Coordinate inter-school, inter-college, and intra-institution tournaments, along with member competitions. Manage registrations, fixtures, venues, and officials with the participating teams."
      },
      {
        "title": "Coordinate regional participation",
        "text": "Encourage Yi Erode members to participate in tournaments held across Tamil Nadu, including the Yi Masoom Cup cricket tournament, Yi Badminton Tournament, and Yi Pickleball Tournament. Coordinate team formation, practice, registration, and travel arrangements as schedules are announced."
      }
    ]
  },
  {
    "id": "vertical-13",
    "category": "Initiatives",
    "name": "Branding",
    "description": "Tell the story of Yi Erode’s work clearly and consistently. Coordinate with every vertical to turn chapter activities and outcomes into timely, engaging communications.",
    "responsibilities": [
      {
        "title": "Create a monthly chapter newsletter",
        "text": "Collect updates, photographs, and key outcomes from each vertical and prepare a newsletter covering the month’s activities in Yi Erode. Highlight the people involved, the difference made, and upcoming opportunities to participate."
      },
      {
        "title": "Publish a weekly Instagram roundup",
        "text": "Create a weekly post or carousel highlighting Yi Erode’s activities from that week. Coordinate timely inputs from event teams and use clear captions and strong visuals to explain the purpose and outcomes."
      },
      {
        "title": "Review branding and coordinate approvals",
        "text": "Regularly check that chapter creatives, videos, newsletters, and event materials meet Yi’s branding guidelines. Coordinate corrections with the respective teams and obtain the required Chapter Executive Member approval before publication or circulation."
      },
      {
        "title": "Maintain content and share impact stories",
        "text": "Keep photographs, videos, event summaries, and approved creatives organised by vertical and month. Work with vertical leads to share noteworthy stories for wider Yi coverage, and review audience engagement to improve future communications."
      }
    ]
  }
]

export const EOI_COMMITMENTS: readonly EoiCommitment[] = [
  {
    "title": "Pathfinder",
    "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z\"/></svg>",
    "schedule": "First week of January 2027 · Before Pongal · Erode",
    "format": "IN PERSON",
    "description": "A planning dialogue with members of Yi’s National and Regional teams, together with past chairs of Yi Erode. The meeting will help define priorities for the year ahead and highlight key dates to guide the chapter’s activities."
  },
  {
    "title": "EC Leader Academy (EC LA)",
    "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 21h8m-4-5v5m-5-13 5-3 5 3-5 3-5-3Z\"/></svg>",
    "schedule": "First week of January 2027 · Before Pongal · Online · 1 hour",
    "format": "ONLINE",
    "description": "A focused, one-hour orientation for your selected stakeholder, project, or initiative. Gain a clear understanding of the national plans for the year and how they can inform your work in Erode."
  },
  {
    "title": "Regional Council Meeting 2027 (RCM)",
    "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"7\" r=\"3\"/><path d=\"M6 21v-3a6 6 0 0 1 12 0v3M4 5a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 21v-4a4 4 0 0 1 3-4m17 8v-4a4 4 0 0 0-3-4\"/></svg>",
    "schedule": "March 2027 · Host city within Tamil Nadu to be confirmed",
    "format": "IN PERSON",
    "description": "Join EC members from all 16 Tamil Nadu chapters to review progress over the first three months and discuss adjustments within each vertical. Connect with peers working in the same area, exchange ideas across chapters, and take part in local experiences, depending on the host city."
  },
  {
    "title": "EC Meetings",
    "icon": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M7 3v4m10-4v4M3 11h18m-13 5 3 2 5-4\"/></svg>",
    "schedule": "Monthly or once every two months · Erode",
    "format": "IN PERSON",
    "description": "Regular meetings of Yi Erode’s Enablers of Change to review ongoing work, coordinate responsibilities, and plan the month ahead. Your participation helps the team maintain momentum and turn shared priorities into action."
  }
]

export const EOI_CATEGORIES: readonly EoiCategory[] = ['Stakeholders', 'Projects', 'Initiatives']

export const EOI_ROLE_IDS: ReadonlySet<string> = new Set(EOI_ROLES.map(r => r.id))

export function eoiRoleById(id: string): EoiRole | undefined {
  return EOI_ROLES.find(r => r.id === id)
}

/**
 * Extra questions for crowded areas (Director 24 Nov 2026, wording as drafted).
 * Members who pick one of these areas answer both questions (short, required).
 * Keys are stored in yi_connect.ec_eoi_extra_answers: never rename a key.
 */
export interface EoiExtraQuestion {
  key: string
  label: string
}
export const EOI_EXTRA_QUESTIONS: Readonly<Record<string, readonly EoiExtraQuestion[]>> = {
  'vertical-1': [
    { key: 'schools', label: 'Which schools can you bring in, or already have links with?' },
    { key: 'visits', label: 'How many school visits a month can you give?' },
  ],
  'vertical-2': [
    { key: 'colleges', label: 'Which colleges can you bring in, or already have links with?' },
    { key: 'visits', label: 'How many college visits a month can you give?' },
  ],
  'vertical-3': [
    { key: 'villages', label: 'Which villages or self-help groups do you already work with?' },
    { key: 'travel', label: 'Can you travel outside Erode town on weekdays?' },
  ],
  'vertical-9': [
    { key: 'business', label: 'What business have you built or run?' },
    { key: 'founders', label: 'Which founders could you bring to a session?' },
  ],
}
