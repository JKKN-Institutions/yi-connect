/**
 * Yi Future 6.0 — in-app guide content (six lanes + shared glossary).
 *
 * PURE DATA (no JSX / no I/O) so the page, the drawer and print never drift.
 * Authored at a 12th-grade reading level from the real Yi Future routes; every
 * deep-link href was validated against an existing app/yi-future/<area>/page.tsx.
 *
 * Generated 2026-06-14 from the route survey; edit by hand to refine copy.
 */
import type { GuideBook } from "@/lib/yi-future/guide/types";

export const GUIDES: GuideBook = {
  "lanes": {
    "national": {
      "persona": "national",
      "title": "National Admin Guide",
      "tagline": "Run the entire Future edition: set up the program structure, manage chapters and teams, score submissions, and broadcast updates.",
      "whyItMatters": "Future is a national program across six regions and dozens of chapters. Your role is to establish the rules, oversee progress, and coordinate the path from problem selection through national finals. Everything delegates and teams see flows from your setup here.",
      "startHere": {
        "label": "Go to National Dashboard",
        "href": "/yi-future/national/admin"
      },
      "journey": [
        "Set up edition, tracks, and problem statements",
        "Assign chapters and finalize team rosters",
        "Manage scoring rubrics and jury assignments",
        "Monitor leaderboards and finalize nationals",
        "Broadcast updates and export reports"
      ],
      "sections": [
        {
          "id": "program-foundation",
          "title": "Set up the program (Edition, Tracks, Problems)",
          "steps": [
            {
              "action": "Open the **Editions** page to view all yearly cycles.",
              "link": {
                "label": "Editions",
                "href": "/yi-future/national/admin/editions"
              }
            },
            {
              "action": "Choose or activate the **current edition** (only one is active at a time).",
              "detail": "The active edition is where delegates register, teams form, and scoring happens."
            },
            {
              "action": "Go to **Tracks** and review the four thematic areas.",
              "link": {
                "label": "Tracks",
                "href": "/yi-future/national/admin/tracks"
              },
              "detail": "Each track shows icon, color, and description. Switch editions using the tabs if needed."
            },
            {
              "action": "Under each track, add **Problem Statements** (3 per track, 12 total per edition).",
              "link": {
                "label": "Problem Statements",
                "href": "/yi-future/national/admin/problems"
              },
              "detail": "Each problem has a title, short and full description, and optional SDG alignment tags. Teams pick one problem after registering."
            },
            {
              "action": "Set up **Rubrics** (the scoring framework) with weighted criteria.",
              "link": {
                "label": "Rubrics",
                "href": "/yi-future/national/admin/rubrics"
              },
              "tip": "One default rubric per edition. The default is 6 criteria totaling 100 pts; national advancement threshold is 70."
            }
          ]
        },
        {
          "id": "chapter-and-team-management",
          "title": "Manage chapters and teams",
          "steps": [
            {
              "action": "Go to **Chapters** and ensure all participating chapters are listed and active.",
              "link": {
                "label": "Chapters",
                "href": "/yi-future/national/admin/chapters"
              },
              "detail": "Chapters are the Yi units that recruit delegates and run local teams. You can toggle active status and assign region."
            },
            {
              "action": "Check **All Teams** to view team rosters, track status, and identify missing elements (captain, problem, members).",
              "link": {
                "label": "All Teams",
                "href": "/yi-future/national/admin/teams"
              },
              "detail": "Filter by region, track, status, or chapter. The table shows team size (minimum required), captain name, problem selected, and phase progress.",
              "tip": "Chapters form teams during registration. Teams progress through Phase A, B, and C before finalists are shortlisted."
            },
            {
              "action": "Assign **Host Chapters** for regional finales (which chapter hosts the semi-final event).",
              "link": {
                "label": "Host Assignments",
                "href": "/yi-future/national/admin/host-assignments"
              },
              "detail": "Host assignments determine where regional finales happen. Each region may have one or more hosts."
            },
            {
              "action": "Assign **Chapters to Regions** to organize the national structure.",
              "link": {
                "label": "Chapter Assignments",
                "href": "/yi-future/national/admin/chapter-assignments"
              },
              "detail": "This ensures teams are correctly mapped to regional finales and leaderboards."
            }
          ]
        },
        {
          "id": "scoring-and-jury",
          "title": "Set up jury, evaluate submissions, and track scores",
          "steps": [
            {
              "action": "View and assign **Chairs** (chapter leaders) and other personnel.",
              "link": {
                "label": "Chairs",
                "href": "/yi-future/national/admin/chairs"
              },
              "detail": "Chairs lead chapters and may serve as jury. You can view contact info and status."
            },
            {
              "action": "Manage all **Delegates** and identify unassigned ones.",
              "link": {
                "label": "Delegates",
                "href": "/yi-future/national/admin/delegates"
              },
              "detail": "Delegates are college students who register. You can filter unteamed delegates for intervention."
            },
            {
              "action": "Review **Leaderboards** as submissions are scored to see team rankings.",
              "link": {
                "label": "Leaderboards",
                "href": "/yi-future/national/admin/leaderboards"
              },
              "detail": "View rankings by institution, chapter, problem statement, track, or composite score. Export as CSV."
            },
            {
              "action": "Set up the **Finals Schedule** (day 1: keynotes and masterclasses; day 2: semi-finals, grand final, recognition).",
              "link": {
                "label": "Finals Schedule",
                "href": "/yi-future/national/admin/finals/schedule"
              },
              "detail": "The schedule shows times, venues, and status (upcoming, in progress, completed) for each session."
            }
          ]
        },
        {
          "id": "communication-and-exports",
          "title": "Communicate updates and download data",
          "steps": [
            {
              "action": "Send **WhatsApp nudges** to chapter chairs directly from the Dashboard to encourage registrations.",
              "link": {
                "label": "National Dashboard",
                "href": "/yi-future/national/admin"
              },
              "detail": "The dashboard shows delegate counts by region and by chapter. Click Email or WhatsApp to contact chairs with a pre-filled draft."
            },
            {
              "action": "Use **Broadcast** to send a web-push notification to all subscribed admins.",
              "link": {
                "label": "Broadcast",
                "href": "/yi-future/national/admin/broadcast"
              },
              "detail": "This is restricted to super and platform admins. Notifications reach only admins who enabled them in their browser."
            },
            {
              "action": "Download **CSV exports** for every dataset: chapters, delegates, teams, colleges, mentors, jury, partners, evaluations, etc.",
              "link": {
                "label": "Downloads",
                "href": "/yi-future/national/admin/downloads"
              },
              "detail": "Region-aware downloads limit rows to your selected region. Use this for analysis, reporting, and offline workflows (e.g., chair provisioning)."
            },
            {
              "action": "Review **Whitepapers**, **Government**, **Media**, and **Compendium** pages to manage content and external-facing materials.",
              "detail": "These store resources, case studies, policy docs, and partner materials for reference and distribution."
            }
          ]
        },
        {
          "id": "administration",
          "title": "Manage admin accounts and settings",
          "steps": [
            {
              "action": "Go to **Admins** to view and manage national admin accounts.",
              "link": {
                "label": "Admins",
                "href": "/yi-future/national/admin/admins"
              },
              "detail": "Only platform admins can add or remove admin access. You can see who has access and their roles."
            },
            {
              "action": "Use **WhatsApp Connect** to set up two-way WhatsApp integration for outreach campaigns.",
              "link": {
                "label": "Connect WhatsApp",
                "href": "/yi-future/national/admin/whatsapp-connect"
              },
              "detail": "Once connected, you can send templated messages to chapters and track responses."
            },
            {
              "action": "Access **WhatsApp Outreach** to launch bulk messaging to cohorts.",
              "link": {
                "label": "WhatsApp Outreach",
                "href": "/yi-future/national/admin/whatsapp-outreach"
              },
              "detail": "Send event announcements, phase deadlines, or calls for team formation to cohorts in bulk."
            }
          ]
        }
      ]
    },
    "chapter": {
      "persona": "chapter",
      "title": "Chapter Admin Guide for Yi Future 6.0",
      "tagline": "Run your city's 90-day innovation program from registration through final results.",
      "whyItMatters": "Your chapter leads the entire local program—onboarding delegates, assembling teams, managing mentors, tracking progress through three phases of work, and hosting the final event where winners advance to nationals. Getting this right sets delegates up to solve real problems.",
      "startHere": {
        "label": "Go to Chapter Overview",
        "href": "/yi-future/chapter"
      },
      "journey": [
        "Set up your chapter and core team",
        "Reach out to colleges and register delegates",
        "Form teams and assign problem statements",
        "Guide teams through 90-day phases",
        "Run jury scoring and announce winners"
      ],
      "sections": [
        {
          "id": "chapter-setup",
          "title": "Set Up Your Chapter",
          "steps": [
            {
              "action": "Open **Chapter Setup** and fill in your chapter's profile (name, city, state, region, logo).",
              "link": {
                "label": "Go to Setup",
                "href": "/yi-future/chapter/setup"
              },
              "detail": "Your chapter profile is shared across the program."
            },
            {
              "action": "Choose a **programme duration** (30, 60, or 90 days).",
              "link": {
                "label": "Go to Setup",
                "href": "/yi-future/chapter/setup"
              },
              "detail": "This locks once the first phase event is created, so decide before then.",
              "tip": "90 days is standard for Future 6.0."
            },
            {
              "action": "Add the **4-role core team**: Event Lead, Outreach Lead, Mentorship & Content Lead, Ops & Documentation Lead.",
              "link": {
                "label": "Go to Setup",
                "href": "/yi-future/chapter/setup"
              },
              "detail": "Enter each person's full name, email, and phone. If they have a Yi login, their auth links automatically.",
              "tip": "Your core team runs the entire chapter program—pick people who can commit."
            },
            {
              "action": "Set **finale dates** if you know them (start and end date of your chapter final event).",
              "link": {
                "label": "Go to Setup",
                "href": "/yi-future/chapter/setup"
              },
              "detail": "You can update these anytime."
            }
          ]
        },
        {
          "id": "colleges-outreach",
          "title": "Reach Out & Bring in Colleges",
          "steps": [
            {
              "action": "Open **Colleges** and add the 3+ colleges you'll recruit from.",
              "link": {
                "label": "Go to Colleges",
                "href": "/yi-future/chapter/colleges"
              },
              "detail": "Provide the college name, city, state, primary contact (name, email, phone), and whether it's a Yi YUVA partner."
            },
            {
              "action": "Track **pending college approvals**—student registrations create new college names that need review.",
              "link": {
                "label": "Go to Colleges",
                "href": "/yi-future/chapter/colleges?tab=pending"
              },
              "detail": "Approve each as a new college, merge it into an existing one, or edit and approve.",
              "tip": "The system suggests merges for names that look similar (e.g., typos)."
            },
            {
              "action": "Use the **Outreach** section to log college visits, talks, and recruitment activities.",
              "detail": "This tracks your outreach progress toward the chapter's goals."
            }
          ]
        },
        {
          "id": "delegates-teams",
          "title": "Register Delegates & Form Teams",
          "steps": [
            {
              "action": "Monitor **Delegates**—student registrations flow in as they use their access codes.",
              "link": {
                "label": "Go to Delegates",
                "href": "/yi-future/chapter/delegates"
              },
              "detail": "Each delegate is linked to a college, year of study, and course. The system counts them toward your 15+ target.",
              "tip": "Regenerate an access code if a delegate loses theirs."
            },
            {
              "action": "Review **Consent letters** from delegates and their parents (travel, medical, liability).",
              "link": {
                "label": "Go to Consent",
                "href": "/yi-future/chapter/consent"
              },
              "detail": "Upload PDFs and approve or reject. You can request corrections and reapproval.",
              "tip": "No delegate can participate without approved consent."
            },
            {
              "action": "Open **Teams** and create teams manually or let delegates self-organize (depends on your edition rules).",
              "link": {
                "label": "Go to Teams",
                "href": "/yi-future/chapter/teams"
              },
              "detail": "A team has 2–5 delegates, a captain, and one **problem statement** from the 4 tracks. Teams are ready to submit once they meet these requirements.",
              "tip": "Export teams to CSV anytime."
            },
            {
              "action": "Assign each **team a problem statement** from the edition's problem catalog.",
              "link": {
                "label": "Go to Problem Statements",
                "href": "/yi-future/chapter/problems"
              },
              "detail": "View all 12 problems (3 per track) and see how many teams have chosen each. Future 6.0 runs all 4 tracks at every chapter.",
              "tip": "Teams can later request to switch problems during Phase A if needed."
            }
          ]
        },
        {
          "id": "manage-journey",
          "title": "Track the 90-Day Journey",
          "steps": [
            {
              "action": "Open **Journey** to set up and manage the three phases.",
              "link": {
                "label": "Go to Journey",
                "href": "/yi-future/chapter/journey"
              },
              "detail": "Create phase events (sessions, deadlines, milestones) for each phase. The system provides a template based on your chosen duration.",
              "tip": "Phase A is Understand, Phase B is Solution Development, Phase C is Refinement."
            },
            {
              "action": "Schedule **phase events**—meetings, mentoring sessions, submission deadlines, etc.",
              "link": {
                "label": "Go to Journey",
                "href": "/yi-future/chapter/journey"
              },
              "detail": "Set the date, time, venue, and mode (online/offline) for each event. Mark them complete as they happen.",
              "tip": "Teams see these dates and deadlines; keep them updated."
            },
            {
              "action": "View **phase progress** on the home overview (Phase Tracker shows completed vs. scheduled events).",
              "link": {
                "label": "Go to Overview",
                "href": "/yi-future/chapter"
              },
              "detail": "At any time, you can advance to the next stage on the home screen (with national sign-off)."
            }
          ]
        },
        {
          "id": "mentors-experts",
          "title": "Assign Mentors & Experts",
          "steps": [
            {
              "action": "Open **Mentors** and add mentors who will guide teams throughout the 90 days.",
              "link": {
                "label": "Go to Mentors",
                "href": "/yi-future/chapter/mentors"
              },
              "detail": "Enter mentor name, title, organization, email, phone, and area of expertise.",
              "tip": "Mentors get an access code and sign in via the delegate/mentor app to provide feedback."
            },
            {
              "action": "Assign each **mentor to 1–2 teams** based on their expertise and the team's problem.",
              "link": {
                "label": "Go to Mentors",
                "href": "/yi-future/chapter/mentors"
              },
              "detail": "Use the dropdown to match mentors; the system can also auto-allocate based on expertise tags.",
              "tip": "Regenerate a mentor's access code if they lose it."
            },
            {
              "action": "Add **Experts** who review submissions and advise on specific tracks or topics.",
              "link": {
                "label": "Go to Experts",
                "href": "/yi-future/chapter/experts"
              },
              "detail": "Experts are optional advisors; mentors are required for team feedback."
            }
          ]
        },
        {
          "id": "jury-scoring",
          "title": "Set Up Jury & Score Submissions",
          "steps": [
            {
              "action": "Open **Jury** and add jury members who will score team submissions.",
              "link": {
                "label": "Go to Jury",
                "href": "/yi-future/jury"
              },
              "detail": "Each jury member has a name, archetype (e.g., expert, industry, academic), and assignment to teams or a phase.",
              "tip": "A rubric defines the scoring criteria and max points."
            },
            {
              "action": "Review **Submissions**—view which teams have submitted for each phase.",
              "link": {
                "label": "Go to Submissions",
                "href": "/yi-future/chapter/submissions"
              },
              "detail": "The matrix shows team status (draft, submitted, approved, rejected) for all three phases.",
              "tip": "Teams can resubmit if rejected."
            },
            {
              "action": "Open **Scoring** once teams have submitted and jury is ready.",
              "link": {
                "label": "Go to Scoring",
                "href": "/yi-future/chapter/scoring"
              },
              "detail": "See aggregated jury scores per team, per phase. Teams that score above the national threshold advance to nationals.",
              "tip": "Check the default rubric to understand scoring thresholds."
            }
          ]
        },
        {
          "id": "results-final",
          "title": "Announce Results & Host Chapter Final",
          "steps": [
            {
              "action": "Open **Results**—this computes which teams meet the national advancement threshold.",
              "link": {
                "label": "Go to Results",
                "href": "/yi-future/chapter/results"
              },
              "detail": "Teams are ranked by score. Check which teams qualify to advance to regional/national levels.",
              "tip": "You can override if national has given you special instructions."
            },
            {
              "action": "Open **Leaderboard** to see the chapter-wide rankings by track and overall.",
              "link": {
                "label": "Go to Leaderboard",
                "href": "/yi-future/chapter/leaderboard"
              },
              "detail": "Share this with delegates as motivation, or use it to announce winners."
            },
            {
              "action": "Open **Chapter Final** and create your day-90 finale event.",
              "link": {
                "label": "Go to Chapter Final",
                "href": "/yi-future/chapter/final"
              },
              "detail": "Set the event name, tagline, date, and venue. This is where teams pitch and winners are announced.",
              "tip": "Publish the event so delegates can see the details."
            },
            {
              "action": "Use **Messages** to broadcast announcements to all chapters, or send targeted messages to mentors, jury, or teams.",
              "link": {
                "label": "Go to Messages",
                "href": "/yi-future/chapter/messages"
              },
              "detail": "Keep everyone informed of key deadlines and next steps."
            }
          ]
        },
        {
          "id": "track-overview",
          "title": "Monitor & Communicate (Ongoing)",
          "steps": [
            {
              "action": "Return to **Overview** regularly to see live counts: core team, colleges, delegates, teams, mentors.",
              "link": {
                "label": "Go to Overview",
                "href": "/yi-future/chapter"
              },
              "detail": "Green checkmarks show when you meet minimum thresholds (e.g., 15+ delegates, 5+ teams).",
              "tip": "Dashboard shows the 4 tracks and which problem statement each track leads with."
            },
            {
              "action": "Use **Problem Statements** page to see which problems are popular and how many teams are working on each.",
              "link": {
                "label": "Go to Problem Statements",
                "href": "/yi-future/chapter/problems"
              },
              "detail": "Read-only; problems are set by national. Use this to balance team assignments."
            },
            {
              "action": "Check **Allocations** to see assign mentors to teams, manage expert availability, and view team-to-mentor mappings.",
              "link": {
                "label": "Go to Allocations",
                "href": "/yi-future/chapter/allocations"
              },
              "detail": "Helps you ensure every team has mentor coverage."
            }
          ]
        }
      ]
    },
    "delegate": {
      "persona": "delegate",
      "title": "Delegate Guide to Yi Future 6.0",
      "tagline": "College students working in teams to solve real-world problems over 90 days and compete nationally.",
      "whyItMatters": "Yi Future 6.0 gives you hands-on experience solving national problems in education, climate, health, or road safety alongside mentors and your peers. Your team's work will be scored against a rubric, and the best teams advance to regional and national finals for recognition and internship opportunities.",
      "startHere": {
        "label": "Go to your dashboard",
        "href": "/yi-future/me"
      },
      "journey": [
        "Sign in with your access code",
        "Form or join a team from your chapter",
        "Pick a problem statement from your track",
        "Attend journey events and earn points",
        "Submit three deliverables across three phases",
        "Get mentor feedback and compete for awards"
      ],
      "sections": [
        {
          "id": "sign-in-and-team",
          "title": "1. Sign in and build your team",
          "steps": [
            {
              "action": "Open the **dashboard** using your **access code** to sign in.",
              "detail": "You'll see your chapter name and a quick nav to all features. Your access code appears on the dashboard if you ever need it again.",
              "link": {
                "label": "Dashboard",
                "href": "/yi-future/me"
              }
            },
            {
              "action": "Check if anyone has invited you to a **team** — tap **Check invitations**.",
              "detail": "If you've been invited, you can accept or decline. Once you accept, you're on the team.",
              "link": {
                "label": "Team invitations",
                "href": "/yi-future/me/team/invites"
              }
            },
            {
              "action": "If no invitations, tap **Create a team** and choose a **team name**.",
              "detail": "You become the captain. You can invite up to 4 other members from your chapter. Your team needs at least 2 members to submit work.",
              "link": {
                "label": "Create or manage team",
                "href": "/yi-future/me/team"
              }
            },
            {
              "action": "As captain, use the **chapter directory** to find and invite classmates to your team.",
              "detail": "You can send an optional message with each invite. Pending invites are tracked and you can see who is already on another team or is alumni from a past year.",
              "link": {
                "label": "Chapter directory",
                "href": "/yi-future/me/team/directory"
              }
            },
            {
              "action": "Set a **team leader** and **confirm your team** when you're ready (captain only).",
              "detail": "The leader helps coordinate submissions. Once you confirm, you cannot add or remove members. You must have picked a problem statement first.",
              "link": {
                "label": "Team page",
                "href": "/yi-future/me/team"
              },
              "tip": "Confirming your team is final — choose carefully."
            }
          ]
        },
        {
          "id": "pick-problem-and-journey",
          "title": "2. Pick your problem and start the 90-day journey",
          "steps": [
            {
              "action": "Go to **My team** and scroll to **Problem statement**.",
              "detail": "All four tracks are shown (Accessibility, Climate Action, Health, Road Safety) with three problems in each. Read the titles and descriptions carefully.",
              "link": {
                "label": "Team page",
                "href": "/yi-future/me/team"
              }
            },
            {
              "action": "Select the **one problem** your team will tackle for 90 days and tap **Pick this problem**.",
              "detail": "You can re-pick if needed before confirming your team, but after confirmation it is locked. Make sure your team agrees.",
              "link": {
                "label": "Team page",
                "href": "/yi-future/me/team"
              }
            },
            {
              "action": "Tap **Journey** to see all 90-day events (Phase A, Phase B, Phase C) and track your attendance.",
              "detail": "Each phase has workshops and checkpoints. A **Journey Score** shows how many events you've attended — this counts toward your final score. Attend to rack up points.",
              "link": {
                "label": "Your journey",
                "href": "/yi-future/me/journey"
              }
            },
            {
              "action": "Check **Resources** to read mentor-shared study material, decks, and links.",
              "detail": "Mentors post guides and templates here as each phase starts. New resources appear over time.",
              "link": {
                "label": "Study resources",
                "href": "/yi-future/me/resources"
              }
            }
          ]
        },
        {
          "id": "submit-deliverables",
          "title": "3. Submit deliverables each phase (captain only)",
          "steps": [
            {
              "action": "Go to **Submissions** (captain-only page) after your team picks a problem.",
              "detail": "You will see three sections: Phase A (Problem Definition), Phase B (Draft Framework), Phase C (Final). Each has its own upload form.",
              "link": {
                "label": "Deliverables",
                "href": "/yi-future/me/submissions"
              }
            },
            {
              "action": "In **Phase A**, upload your **Problem Definition Note** (1 page, public link) and a summary of what you learned.",
              "detail": "Save drafts anytime. When ready, submit for chapter admin review. Once submitted or approved, you cannot edit.",
              "link": {
                "label": "Deliverables",
                "href": "/yi-future/me/submissions"
              }
            },
            {
              "action": "In **Phase B**, upload your **Draft Solution** (policy framework outline) and summary of your approach.",
              "detail": "Again, save drafts and submit when ready. Admin reviews and gives feedback.",
              "link": {
                "label": "Deliverables",
                "href": "/yi-future/me/submissions"
              }
            },
            {
              "action": "In **Phase C**, upload four required files: **Policy Document**, **Execution Plan**, **Scalability Model**, and **Presentation Deck**.",
              "detail": "These are your final artifacts. Include a summary of how you refined your solution based on feedback from Phase B.",
              "link": {
                "label": "Deliverables",
                "href": "/yi-future/me/submissions"
              }
            },
            {
              "action": "Read **Admin Feedback** shown on each submission card.",
              "detail": "If your submission is rejected, it will show feedback and you can resubmit. Approved submissions are locked.",
              "link": {
                "label": "Deliverables",
                "href": "/yi-future/me/submissions"
              }
            }
          ]
        },
        {
          "id": "mentor-and-partners",
          "title": "4. Get feedback and interview for opportunities",
          "steps": [
            {
              "action": "Tap **Messages** to chat directly with your **mentors** one-on-one.",
              "detail": "Mentors are automatically linked to your team. Each mentor gets a conversation thread. Ask questions and get real-time guidance.",
              "link": {
                "label": "Messages",
                "href": "/yi-future/me/messages"
              }
            },
            {
              "action": "Check **Feedback** to read mentor notes and ratings after each phase checkpoint.",
              "detail": "Mentors share strengths, areas to improve, and next steps. You earn a score for each phase.",
              "link": {
                "label": "Mentor feedback",
                "href": "/yi-future/me/feedback"
              }
            },
            {
              "action": "Add or update your **resume** (public link) on the resume page.",
              "detail": "Only delegates from teams advancing to nationals are shown to corporate partners. Partners use your resume to schedule interviews.",
              "link": {
                "label": "Your resume",
                "href": "/yi-future/me/resume"
              }
            },
            {
              "action": "Check **Interviews** to see internship opportunities partners have lined up for you.",
              "detail": "Once your team qualifies, you'll see interview dates, partner names, domains, and outcomes (offered, shortlisted, follow-up, no fit). Partners add notes after each interview.",
              "link": {
                "label": "Your interviews",
                "href": "/yi-future/me/interviews"
              }
            }
          ]
        },
        {
          "id": "results-and-recognition",
          "title": "5. See your team results and awards",
          "steps": [
            {
              "action": "Tap **Results** after your chapter runs its final to see how your team placed.",
              "detail": "You'll see any awards (Best Innovation, Policy Impact, etc.), advancements to regional/national finals, and your rank and score.",
              "link": {
                "label": "Team results",
                "href": "/yi-future/me/results"
              }
            },
            {
              "action": "View **awards** your team won, complete with the award name and jury citation.",
              "detail": "Awards are the top prizes given at chapter, regional, and national levels. Winning teams are announced and celebrated."
            },
            {
              "action": "Check if your team **advanced** to the next event level (regional final or nationals).",
              "detail": "Advancements show your team's rank, total score, and the next event you're competing in."
            }
          ]
        }
      ]
    },
    "mentor": {
      "persona": "mentor",
      "title": "Mentor Guide · Yi Future 6.0",
      "tagline": "Guide your assigned teams through a 90-day innovation journey, from problem understanding to solution refinement.",
      "whyItMatters": "Mentors shape teams' problem-solving approach and keep them on track across three phases. Your feedback on participation, solution quality, progress, and growth directly influences the team's score and their path to nationals.",
      "startHere": {
        "label": "Go to Mentor Dashboard",
        "href": "/yi-future/mentor"
      },
      "journey": [
        "Log in and view your assigned teams",
        "Message your team weekly with guidance",
        "Share resources and best practices",
        "Score each team after key phases",
        "Track team progress and submit final evaluations"
      ],
      "sections": [
        {
          "id": "stay-connected",
          "title": "Stay Connected with Your Teams",
          "steps": [
            {
              "action": "Open the **Messages** tab to see all assigned teams.",
              "detail": "Each team has one conversation thread. New replies show up live.",
              "link": {
                "label": "Messages",
                "href": "/yi-future/mentor/messages"
              }
            },
            {
              "action": "Select a **team** from the list to open the conversation.",
              "detail": "On mobile, click a team name to expand the full chat. On desktop, the chat appears on the right.",
              "tip": "Teams appear in this list automatically once your chapter admin assigns them to you."
            },
            {
              "action": "Type a **message** to reply.",
              "detail": "Share guidance, ask clarifying questions, or point them toward resources. Keep it focused and actionable.",
              "tip": "Mentors typically message their teams after each phase event or milestone."
            }
          ]
        },
        {
          "id": "share-resources",
          "title": "Share Resources with All Teams",
          "steps": [
            {
              "action": "Open the **Resources** tab.",
              "detail": "You can upload files or link external websites. Every team in this edition can access them.",
              "link": {
                "label": "Resources",
                "href": "/yi-future/mentor/resources"
              }
            },
            {
              "action": "Click **Add a resource** and fill in the title.",
              "detail": "For example: 'Policy Brief Template' or 'Accessibility Checklist—Phase B.'"
            },
            {
              "action": "Add an optional **description**.",
              "detail": "Explain what's inside and how teams should use it. For example: 'Use this one-pager to draft your problem hypothesis.'",
              "tip": "A good description saves your teams time."
            },
            {
              "action": "Choose **File upload** or **External link**.",
              "detail": "File upload: Documents, PDFs, or spreadsheets. External link: Google Docs, video, article, or tool."
            },
            {
              "action": "Upload or paste the **URL** and click **Add resource**.",
              "detail": "The resource is now visible to all teams in the edition immediately."
            }
          ]
        },
        {
          "id": "evaluate-teams",
          "title": "Score Teams on Their Progress",
          "steps": [
            {
              "action": "Go to a **team's page** in the Messages tab.",
              "detail": "From the message thread, look for a link to the scoring page, or navigate directly to `/yi-future/mentor/scoring/[teamId]`.",
              "tip": "Your chapter admin provides the team ID when they assign you."
            },
            {
              "action": "Select the **phase or event** this evaluation covers.",
              "detail": "For example: 'Phase A: Problem Understanding (Dec 15)' or leave it blank for 'Overall.' This helps track progress across the journey.",
              "link": {
                "label": "Scoring",
                "href": "/yi-future/mentor"
              }
            },
            {
              "action": "Score each **criterion** on the rubric (0 to max points).",
              "detail": "Criteria: Participation (how engaged the team is), Submission Quality, Progress (toward solving), Engagement (with mentorship), and Growth (learning from feedback).",
              "tip": "Read the description under each criterion—it explains what 'good' looks like at different score levels."
            },
            {
              "action": "Add **mentor notes**.",
              "detail": "Comment on what went well, what to improve next, blockers you spotted, or anything the chapter admin should know.",
              "tip": "Notes help the team and chapter admin understand your scores."
            },
            {
              "action": "Click **Save draft** if you are still gathering information.",
              "detail": "You can return later to edit your scores before submitting."
            },
            {
              "action": "Click **Submit evaluation** when ready.",
              "detail": "Once submitted, your scores lock and show on the team's record. The total score is calculated automatically."
            }
          ]
        },
        {
          "id": "understand-phases",
          "title": "Know the Three Phases of the Journey",
          "steps": [
            {
              "action": "Understand **Phase A: Understand the Problem** (Weeks 1–4).",
              "detail": "Teams research their assigned problem statement and write a problem hypothesis. Your role: help them ask better questions, find credible sources, and narrow scope.",
              "tip": "Push them to talk to at least three real people affected by the problem."
            },
            {
              "action": "Support **Phase B: Solution Development** (Weeks 5–8).",
              "detail": "Teams ideate, prototype, and test a solution. Your role: challenge assumptions, flag feasibility issues, suggest iteration.",
              "tip": "Solutions can be tech, policy, curriculum, service design—it depends on the track and problem."
            },
            {
              "action": "Refine in **Phase C: Refinement** (Weeks 9–12).",
              "detail": "Teams polish their pitch, gather evidence, and prepare for jury scoring. Your role: tighten narrative, validate impact claims, coach presentation.",
              "tip": "Quality of the final submission determines placement; your feedback here counts most."
            }
          ]
        },
        {
          "id": "know-the-rubric",
          "title": "Use the Mentor Rubric",
          "steps": [
            {
              "action": "Review the **five scoring criteria** before evaluating.",
              "detail": "Participation, Submission Quality, Progress, Engagement, and Growth. Each has a max score; the total determines the team's mentor score.",
              "tip": "All teams in your edition are scored on the same rubric, so scores are fair across chapters."
            },
            {
              "action": "Score **Participation** by attendance, responsiveness, and effort.",
              "detail": "Did they show up to calls? Did they act on feedback? Do they ask good questions?"
            },
            {
              "action": "Score **Submission Quality** by clarity, depth, and professionalism.",
              "detail": "Is the written work polished? Do arguments have evidence? Is the thinking rigorous?"
            },
            {
              "action": "Score **Progress** by movement toward a solved problem.",
              "detail": "Are they moving faster and smarter this phase than last? Or stuck in the same place?"
            },
            {
              "action": "Score **Engagement** by their openness to mentorship.",
              "detail": "Do they ask you questions? Do they implement suggestions? Or ignore feedback?"
            },
            {
              "action": "Score **Growth** by what they learned from Phase A→B→C.",
              "detail": "Are they thinking more deeply? Asking harder questions? Pivoting smartly?"
            }
          ]
        }
      ]
    },
    "jury": {
      "persona": "jury",
      "title": "Jury Member Guide",
      "tagline": "Score team submissions against the rubric to advance the strongest solutions to nationals.",
      "whyItMatters": "Your scoring shapes which teams move forward. Fair, thoughtful evaluation helps Yi Future discover the most promising student solutions across India.",
      "startHere": {
        "label": "Go to your jury home",
        "href": "/yi-future/jury"
      },
      "journey": [
        "Sign in with your jury access code",
        "View the teams assigned to your panel",
        "Open a team's submission and review their problem statement",
        "Score against the rubric criteria and share your feedback",
        "Submit or save a draft; see other panelists' scores after you submit"
      ],
      "sections": [
        {
          "id": "get-started",
          "title": "Sign In and View Your Teams",
          "steps": [
            {
              "action": "Use your **access code** to sign into Yi Future. You will be redirected to your jury home.",
              "detail": "Your access code was provided when you were added to the jury panel. If you do not have it, ask your chapter admin.",
              "link": {
                "label": "Jury home",
                "href": "/yi-future/jury"
              }
            },
            {
              "action": "Review the list of **teams assigned to your panel** on your jury home screen.",
              "detail": "The list shows each team's name, the problem statement they are solving, and the status of your evaluation (Pending, Draft saved, or Submitted).",
              "tip": "A green checkmark means you have already submitted your score for that team; a yellow tag means you saved a draft but did not submit yet; a gray label means you have not started."
            }
          ]
        },
        {
          "id": "open-team",
          "title": "Open a Team's Submission",
          "steps": [
            {
              "action": "Click on a **team name** or **problem statement** from your list to open their submission page.",
              "detail": "The submission page shows the team name, their problem statement with description, and the scoring form you will use.",
              "link": {
                "label": "Team submission",
                "href": "/yi-future/jury"
              }
            },
            {
              "action": "Read the **problem statement** at the top to understand what the team is solving.",
              "detail": "The statement includes a title and short description. This is the context for your scoring.",
              "tip": "Note that team member names are hidden to protect against bias. You will score only the work, not the people."
            }
          ]
        },
        {
          "id": "score-criteria",
          "title": "Score Against the Rubric",
          "steps": [
            {
              "action": "Score each **criterion** in the rubric by entering a number between 0 and the maximum for that criterion.",
              "detail": "Each criterion (e.g., Innovation, Feasibility, Impact) has a label, description, and maximum score. Enter your score in the input field. You can use half-points (e.g., 7.5).",
              "tip": "Read the criterion description carefully. It tells you what to look for—depth, clarity, originality, evidence, feasibility, etc."
            },
            {
              "action": "In the **Judge Comments** section, fill in the structured feedback fields.",
              "detail": "Four fields guide your feedback: Key Strengths (what stood out), Key Gaps (what was missing), Scalability Assessment (will this work across India?), and Policy Relevance (does this shape national policy?).",
              "tip": "Comments help the team improve and help the chapter admin understand the panel's reasoning."
            },
            {
              "action": "Select a **recommendation** option: Strongly Recommend, Recommend, or Not Recommended.",
              "detail": "Your recommendation is your overall judgment. This signal helps leaders decide which teams advance.",
              "tip": "You can change your recommendation at any time before you submit your evaluation."
            }
          ]
        },
        {
          "id": "save-or-submit",
          "title": "Save Your Work and Submit",
          "steps": [
            {
              "action": "Click **Save draft** to save your scores and comments without submitting them yet.",
              "detail": "A draft lets you come back later to review and refine your feedback before making it official.",
              "tip": "Drafts are stored locally. Save often so you don't lose your work."
            },
            {
              "action": "When you are ready to finalize your evaluation, click **Submit evaluation**.",
              "detail": "Submitting locks your scores and comments. You will not be able to edit them after submission. Your total score is calculated and displayed.",
              "tip": "After you submit, a success message will appear. You will be able to see other panelists' scores once they submit theirs too. This protects against bias."
            }
          ]
        },
        {
          "id": "review-panel",
          "title": "Review Other Panelists' Scores",
          "steps": [
            {
              "action": "After you **submit your evaluation**, return to the same team page to see the **'Other panel scores'** section.",
              "detail": "This section shows the scores, recommendations, and selected feedback from other jurors who have submitted. It appears only after you have submitted (to prevent bias).",
              "tip": "Compare your reasoning with the panel's. Alignment or divergence can inform future evaluations."
            },
            {
              "action": "Return to your **jury home** and click the next unscored team to continue.",
              "detail": "The dashboard shows how many teams remain to be scored.",
              "link": {
                "label": "Jury home",
                "href": "/yi-future/jury"
              }
            }
          ]
        }
      ]
    },
    "partner": {
      "persona": "partner",
      "title": "Partner Recruiting Guide",
      "tagline": "Review finalist resumes and run interviews to recruit Young Indians delegates.",
      "whyItMatters": "Yi Future attracts top college innovators across Accessibility, Climate Action, Health, and Road Safety. As a partner, you get direct access to this talent pool and can make early hiring decisions on candidates at their strongest—after three months of intensive problem-solving in a national program.",
      "startHere": {
        "label": "Go to Partner Home",
        "href": "/yi-future/partner"
      },
      "journey": [
        "Sign in with your access code",
        "Review finalist resumes and backgrounds",
        "Attend scheduled interviews with candidates",
        "Record hiring outcomes and notes",
        "Track interview results"
      ],
      "sections": [
        {
          "id": "sign-in-and-home",
          "title": "Sign in and view your dashboard",
          "steps": [
            {
              "action": "Visit the Yi Future Partner portal and **sign in** with your access code.",
              "detail": "You will see your organization's name, the edition, chapter, and city."
            },
            {
              "action": "On your **dashboard**, review the quick stats: your active internship slots, total openings, upcoming interviews, and completed interviews.",
              "link": {
                "label": "Partner Home",
                "href": "/yi-future/partner"
              },
              "detail": "This is your landing page after every sign-in. It shows a snapshot of your recruiting activity."
            },
            {
              "action": "Read the **Your internship slots** section to see which roles you are hiring for.",
              "detail": "The slots show the position title and how many openings are available. To add or edit slots, ask your host chapter admin."
            }
          ]
        },
        {
          "id": "review-resumes",
          "title": "Review finalist resumes",
          "steps": [
            {
              "action": "On your dashboard, click the **Finalist resumes** card to see all candidates.",
              "link": {
                "label": "Finalist Resumes",
                "href": "/yi-future/partner/resumes"
              },
              "detail": "You will see every delegate whose team advanced to the finalist round of Yi Future."
            },
            {
              "action": "Scan the delegate list for their **name**, college, chapter, course, year of study, home state, and email.",
              "detail": "This information helps you understand their background and where they are studying."
            },
            {
              "action": "Click **Open resume** on any candidate to download their full resume.",
              "detail": "If no resume button appears, that delegate has not uploaded a resume yet. You can still reach out by email if listed."
            },
            {
              "action": "Make a note of top prospects whose skills match your internship slots.",
              "tip": "Look for candidates whose course, year, and location align with your hiring needs."
            }
          ]
        },
        {
          "id": "conduct-interviews",
          "title": "Conduct interviews and record outcomes",
          "steps": [
            {
              "action": "On your dashboard, click the **Upcoming interviews** card to see all scheduled interview slots.",
              "link": {
                "label": "Your Interviews",
                "href": "/yi-future/partner/interviews"
              },
              "detail": "You will see the date, time, duration, room location, and which internship role the interview is for."
            },
            {
              "action": "Before each interview, review the candidate's **name**, email, college, course, year, and resume link.",
              "detail": "Arrive prepared with their background. You can open their resume right from the interview listing."
            },
            {
              "action": "Attend the interview at the listed date, time, and room.",
              "detail": "The interview logistics (date, time, room, duration) are set by your chapter admin. Coordinate with them if you have conflicts."
            },
            {
              "action": "After the interview, use the **outcome dropdown** to record your hiring decision.",
              "detail": "Choose: Offered, Shortlisted, Follow-up, No fit, or leave blank if undecided."
            },
            {
              "action": "Add any **private notes** in the notes field to capture feedback and next steps.",
              "tip": "Use notes to explain your decision, record their strengths, or flag candidates for follow-up."
            },
            {
              "action": "Click **Save outcome** to store your decision and notes.",
              "detail": "Your data saves immediately. You can edit it anytime by returning to the interviews page."
            }
          ]
        },
        {
          "id": "track-progress",
          "title": "Track your interview results",
          "steps": [
            {
              "action": "On your dashboard, check the stats at the top to see how many interviews are upcoming and completed.",
              "link": {
                "label": "Partner Home",
                "href": "/yi-future/partner"
              },
              "detail": "As you record outcomes, your completed interview count increases."
            },
            {
              "action": "Return to your **interviews page** to review all recorded outcomes and notes in one place.",
              "link": {
                "label": "Your Interviews",
                "href": "/yi-future/partner/interviews"
              },
              "detail": "Scan through to see your hiring progress across all finalists."
            },
            {
              "action": "Update any outcome or note by editing the form and clicking **Save outcome** again.",
              "tip": "You can change your decision at any time before the final results are locked by the chapter admin."
            }
          ]
        }
      ]
    }
  },
  "glossary": [
    {
      "term": "Edition",
      "def": "One yearly cycle of the Future program (e.g., Future 6.0). Only one is active at a time. Contains all tracks, problems, teams, and results."
    },
    {
      "term": "Track",
      "def": "A thematic area: Accessibility, Climate Action, Health, or Road Safety. Each edition has four tracks. Delegates pick one and work on a problem within it."
    },
    {
      "term": "Problem Statement",
      "def": "A specific challenge within a track that a team solves. Each track has 3 problems; teams pick one after they register."
    },
    {
      "term": "Rubric",
      "def": "The scoring framework with weighted criteria (e.g., innovation, feasibility, impact) that jury members use to evaluate teams. One default per edition and scope."
    },
    {
      "term": "Phase A/B/C",
      "def": "The three 30-, 60-, or 90-day phases of the journey: Understand the problem, Develop a solution, Refine and prepare for final."
    },
    {
      "term": "Access code",
      "def": "A unique code assigned to you that lets you sign into Future and join your chapter. Keep it private."
    },
    {
      "term": "Finalist",
      "def": "A delegate whose team advanced past earlier rounds of the program and is now competing in the final phase. Partners interview finalists to recruit."
    },
    {
      "term": "Internship slot",
      "def": "A job opening or role your company is hiring for in Yi Future (e.g., 'Software Engineer', 'Product Manager'). Interviews are assigned to specific slots."
    },
    {
      "term": "Outcome",
      "def": "Your decision after interviewing a candidate: Offered, Shortlisted, Follow-up, or No fit. This tracks your hiring progress and helps the chapter coordinate results."
    }
  ]
};
