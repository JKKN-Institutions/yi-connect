'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const DEMO_CHAPTER_ID = 'de000001-0000-4000-a000-000000000001'

// Demo member profiles to create
const DEMO_MEMBERS = [
  {
    email: 'rajesh.kumar@demo.yi.org',
    full_name: 'Rajesh Kumar',
    phone: '+919876543001',
    company: 'TechVentures India',
    designation: 'CEO',
    industry: 'Technology',
    years_of_experience: 15,
    gender: 'male',
    city: 'Erode',
    interests: ['entrepreneurship', 'technology', 'mentoring'],
  },
  {
    email: 'priya.sharma@demo.yi.org',
    full_name: 'Priya Sharma',
    phone: '+919876543002',
    company: 'GreenLeaf Organics',
    designation: 'Founder',
    industry: 'Agriculture',
    years_of_experience: 8,
    gender: 'female',
    city: 'Erode',
    interests: ['sustainability', 'organic farming', 'climate action'],
  },
  {
    email: 'arun.patel@demo.yi.org',
    full_name: 'Arun Patel',
    phone: '+919876543003',
    company: 'Patel Textiles',
    designation: 'Director',
    industry: 'Manufacturing',
    years_of_experience: 12,
    gender: 'male',
    city: 'Erode',
    interests: ['manufacturing', 'exports', 'skill development'],
  },
  {
    email: 'lakshmi.venkat@demo.yi.org',
    full_name: 'Lakshmi Venkataraman',
    phone: '+919876543004',
    company: 'EduSpark Academy',
    designation: 'Principal',
    industry: 'Education',
    years_of_experience: 20,
    gender: 'female',
    city: 'Erode',
    interests: ['education', 'child development', 'masoom'],
  },
  {
    email: 'karthik.rajan@demo.yi.org',
    full_name: 'Karthik Rajan',
    phone: '+919876543005',
    company: 'Rajan Motors',
    designation: 'Managing Partner',
    industry: 'Automotive',
    years_of_experience: 10,
    gender: 'male',
    city: 'Erode',
    interests: ['road safety', 'automotive', 'youth programs'],
  },
  {
    email: 'meena.sundaram@demo.yi.org',
    full_name: 'Meena Sundaram',
    phone: '+919876543006',
    company: 'Sundaram Healthcare',
    designation: 'Medical Director',
    industry: 'Healthcare',
    years_of_experience: 18,
    gender: 'female',
    city: 'Erode',
    interests: ['healthcare', 'community health', 'rural development'],
  },
  {
    email: 'vijay.krishnan@demo.yi.org',
    full_name: 'Vijay Krishnan',
    phone: '+919876543007',
    company: 'DigiMedia Solutions',
    designation: 'Creative Director',
    industry: 'Media & Entertainment',
    years_of_experience: 7,
    gender: 'male',
    city: 'Erode',
    interests: ['digital marketing', 'content creation', 'youth engagement'],
  },
  {
    email: 'anitha.balan@demo.yi.org',
    full_name: 'Anitha Balan',
    phone: '+919876543008',
    company: 'Balan Constructions',
    designation: 'Project Manager',
    industry: 'Construction',
    years_of_experience: 9,
    gender: 'female',
    city: 'Erode',
    interests: ['infrastructure', 'sustainable building', 'project management'],
  },
  {
    email: 'sanjay.moorthy@demo.yi.org',
    full_name: 'Sanjay Moorthy',
    phone: '+919876543009',
    company: 'Moorthy Foods',
    designation: 'Operations Head',
    industry: 'Food & Beverage',
    years_of_experience: 11,
    gender: 'male',
    city: 'Erode',
    interests: ['food industry', 'supply chain', 'quality control'],
  },
  {
    email: 'divya.ganesh@demo.yi.org',
    full_name: 'Divya Ganesh',
    phone: '+919876543010',
    company: 'FinWise Consulting',
    designation: 'Financial Advisor',
    industry: 'Finance',
    years_of_experience: 6,
    gender: 'female',
    city: 'Erode',
    interests: ['finance', 'wealth management', 'women entrepreneurship'],
  },
  {
    email: 'suresh.nair@demo.yi.org',
    full_name: 'Suresh Nair',
    phone: '+919876543011',
    company: 'NairTech IT Services',
    designation: 'CTO',
    industry: 'IT Services',
    years_of_experience: 14,
    gender: 'male',
    city: 'Erode',
    interests: ['technology', 'innovation', 'yuva programs'],
  },
  {
    email: 'kavitha.ram@demo.yi.org',
    full_name: 'Kavitha Ramachandran',
    phone: '+919876543012',
    company: 'Green Earth Foundation',
    designation: 'Executive Director',
    industry: 'Non-Profit',
    years_of_experience: 13,
    gender: 'female',
    city: 'Erode',
    interests: ['environment', 'climate action', 'community development'],
  },
]

/**
 * Seeds demo members into the database
 * Requires SUPABASE_SERVICE_ROLE_KEY environment variable
 */
export async function seedDemoMembers(): Promise<{
  success: boolean
  message: string
  created: number
  errors: string[]
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message: 'Missing Supabase credentials',
      created: 0,
      errors: ['SUPABASE_SERVICE_ROLE_KEY not configured'],
    }
  }

  // Create admin client with service role
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const errors: string[] = []
  let created = 0

  // Get Member role ID
  const { data: memberRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('name', 'Member')
    .single()

  if (!memberRole) {
    return {
      success: false,
      message: 'Member role not found',
      created: 0,
      errors: ['Member role does not exist in database'],
    }
  }

  for (const member of DEMO_MEMBERS) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', member.email)
        .single()

      if (existingUser) {
        continue // Skip existing users
      }

      // Create auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: 'DemoMember2024!', // Temporary password
          email_confirm: true,
          user_metadata: {
            full_name: member.full_name,
          },
        })

      if (authError) {
        errors.push(`${member.email}: ${authError.message}`)
        continue
      }

      if (!authData.user) {
        errors.push(`${member.email}: No user returned`)
        continue
      }

      const userId = authData.user.id

      // Update profile with additional data
      await supabaseAdmin
        .from('profiles')
        .update({
          phone: member.phone,
          chapter_id: DEMO_CHAPTER_ID,
        })
        .eq('id', userId)

      // Create member record
      await supabaseAdmin.from('members').insert({
        id: userId,
        chapter_id: DEMO_CHAPTER_ID,
        membership_number: `YI-DEMO-${String(created + 1).padStart(3, '0')}`,
        member_since: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 2
        )
          .toISOString()
          .split('T')[0], // Random date in last 2 years
        membership_status: 'active',
        company: member.company,
        designation: member.designation,
        industry: member.industry,
        years_of_experience: member.years_of_experience,
        gender: member.gender,
        city: member.city,
        state: 'Tamil Nadu',
        country: 'India',
        interests: member.interests,
        is_active: true,
      })

      // Assign Member role
      await supabaseAdmin.from('user_roles').insert({
        user_id: userId,
        role_id: memberRole.id,
      })

      created++
    } catch (error) {
      errors.push(
        `${member.email}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  // Update chapter member count
  await supabaseAdmin
    .from('chapters')
    .update({ member_count: created + 3 }) // +3 for chair, co-chair, ec
    .eq('id', DEMO_CHAPTER_ID)

  revalidatePath('/members')
  revalidatePath('/dashboard')

  return {
    success: errors.length === 0,
    message:
      created > 0
        ? `Created ${created} demo members`
        : 'No new members created',
    created,
    errors,
  }
}

/**
 * Cleans up demo members (for reset functionality)
 */
export async function cleanupDemoMembers(): Promise<{
  success: boolean
  message: string
  deleted: number
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message: 'Missing Supabase credentials',
      deleted: 0,
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Get all demo member emails
  const demoEmails = DEMO_MEMBERS.map((m) => m.email)

  // Get user IDs
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('email', demoEmails)

  if (!profiles || profiles.length === 0) {
    return {
      success: true,
      message: 'No demo members to clean up',
      deleted: 0,
    }
  }

  let deleted = 0

  for (const profile of profiles) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(profile.id)
      deleted++
    } catch {
      // User may have already been deleted
    }
  }

  revalidatePath('/members')
  revalidatePath('/dashboard')

  return {
    success: true,
    message: `Deleted ${deleted} demo members`,
    deleted,
  }
}
