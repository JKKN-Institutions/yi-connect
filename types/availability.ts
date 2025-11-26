/**
 * Availability Type Definitions
 *
 * Types for the member availability calendar system.
 */

// ============================================================================
// Enums and Constants
// ============================================================================

export type AvailabilityStatus = 'available' | 'busy' | 'unavailable'

export type PreferredDays = 'weekdays' | 'weekends' | 'flexible'

export type NoticePeriod = '2_hours' | '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month'

export type GeographicFlexibility = 'erode_only' | 'district' | 'state' | 'zone' | 'pan_india'

export type PreferredContactMethod = 'whatsapp' | 'email' | 'phone' | 'notification'

export type TimeCommitmentHours = 2 | 5 | 10 | 15 | 20

// ============================================================================
// Base Types
// ============================================================================

export interface TimeSlot {
  start: string // HH:MM format
  end: string // HH:MM format
  label?: string
}

export interface Availability {
  id: string
  member_id: string
  date: string // YYYY-MM-DD
  status: AvailabilityStatus
  time_slots: TimeSlot[] | null
  notes: string | null
  time_commitment_hours: TimeCommitmentHours | null
  preferred_days: PreferredDays | null
  notice_period: NoticePeriod | null
  geographic_flexibility: GeographicFlexibility | null
  preferred_contact_method: PreferredContactMethod | null
  is_assigned: boolean
  assigned_session_id: string | null
  blocked_reason: string | null
  created_at: string
  updated_at: string
}

export interface AvailabilityWithMember extends Availability {
  member?: {
    id: string
    profile?: {
      full_name: string
      email: string
      avatar_url: string | null
    }
  }
}

// ============================================================================
// Form Types
// ============================================================================

export interface SetAvailabilityInput {
  member_id: string
  date: string
  status: AvailabilityStatus
  time_slots?: TimeSlot[]
  notes?: string
}

export interface UpdateAvailabilityPreferencesInput {
  member_id: string
  time_commitment_hours?: TimeCommitmentHours
  preferred_days?: PreferredDays
  notice_period?: NoticePeriod
  geographic_flexibility?: GeographicFlexibility
  preferred_contact_method?: PreferredContactMethod
}

export interface BulkSetAvailabilityInput {
  member_id: string
  dates: string[]
  status: AvailabilityStatus
  time_slots?: TimeSlot[]
}

// ============================================================================
// Query Types
// ============================================================================

export interface AvailabilityFilters {
  member_id?: string
  start_date?: string
  end_date?: string
  status?: AvailabilityStatus | AvailabilityStatus[]
  is_assigned?: boolean
}

export interface MemberAvailabilityPreferences {
  member_id: string
  time_commitment_hours: TimeCommitmentHours | null
  preferred_days: PreferredDays | null
  notice_period: NoticePeriod | null
  geographic_flexibility: GeographicFlexibility | null
  preferred_contact_method: PreferredContactMethod | null
}

// ============================================================================
// Calendar Display Types
// ============================================================================

export interface CalendarDay {
  date: string
  dayOfWeek: number
  isToday: boolean
  isCurrentMonth: boolean
  availability?: Availability
}

export interface CalendarWeek {
  weekNumber: number
  days: CalendarDay[]
}

export interface CalendarMonth {
  year: number
  month: number
  weeks: CalendarWeek[]
}

// ============================================================================
// Constants
// ============================================================================

export const AVAILABILITY_STATUSES = ['available', 'busy', 'unavailable'] as const

export const AVAILABILITY_STATUS_INFO: Record<AvailabilityStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  available: {
    label: 'Available',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-500/20',
  },
  busy: {
    label: 'Busy',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  unavailable: {
    label: 'Unavailable',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-500/20',
  },
}

export const TIME_COMMITMENT_OPTIONS = [
  { value: 2, label: '2 hours/week', description: 'Minimal involvement' },
  { value: 5, label: '5 hours/week', description: 'Light involvement' },
  { value: 10, label: '10 hours/week', description: 'Moderate involvement' },
  { value: 15, label: '15 hours/week', description: 'Active involvement' },
  { value: 20, label: '20+ hours/week', description: 'High involvement' },
] as const

export const PREFERRED_DAYS_OPTIONS = [
  { value: 'weekdays', label: 'Weekdays', description: 'Monday to Friday' },
  { value: 'weekends', label: 'Weekends', description: 'Saturday and Sunday' },
  { value: 'flexible', label: 'Flexible', description: 'Any day of the week' },
] as const

export const NOTICE_PERIOD_OPTIONS = [
  { value: '2_hours', label: '2 hours', description: 'Short notice OK' },
  { value: '1_day', label: '1 day', description: 'Need a day\'s notice' },
  { value: '3_days', label: '3 days', description: 'Need a few days notice' },
  { value: '1_week', label: '1 week', description: 'Need a week\'s notice' },
  { value: '2_weeks', label: '2 weeks', description: 'Need two weeks notice' },
  { value: '1_month', label: '1 month', description: 'Need a month\'s notice' },
] as const

export const GEOGRAPHIC_FLEXIBILITY_OPTIONS = [
  { value: 'erode_only', label: 'Erode Only', description: 'Local activities only' },
  { value: 'district', label: 'District', description: 'Within Erode district' },
  { value: 'state', label: 'State', description: 'Anywhere in Tamil Nadu' },
  { value: 'zone', label: 'Zone', description: 'South Zone (TN, KA, KL, AP, TG)' },
  { value: 'pan_india', label: 'Pan India', description: 'Anywhere in India' },
] as const

export const CONTACT_METHOD_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', description: 'Message on WhatsApp' },
  { value: 'email', label: 'Email', description: 'Send an email' },
  { value: 'phone', label: 'Phone Call', description: 'Direct phone call' },
  { value: 'notification', label: 'App Notification', description: 'In-app notification' },
] as const

export const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { start: '09:00', end: '12:00', label: 'Morning' },
  { start: '14:00', end: '17:00', label: 'Afternoon' },
  { start: '18:00', end: '21:00', label: 'Evening' },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate calendar month data
 */
export function generateCalendarMonth(
  year: number,
  month: number,
  availabilities: Availability[]
): CalendarMonth {
  const today = new Date()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Create availability map for quick lookup
  const availabilityMap = new Map<string, Availability>()
  availabilities.forEach((a) => {
    availabilityMap.set(a.date, a)
  })

  const weeks: CalendarWeek[] = []
  let currentWeek: CalendarDay[] = []
  let weekNumber = 1

  // Add days from previous month to fill first week
  const firstDayOfWeek = firstDay.getDay()
  for (let i = firstDayOfWeek; i > 0; i--) {
    const date = new Date(year, month, 1 - i)
    const dateStr = formatDateString(date)
    currentWeek.push({
      date: dateStr,
      dayOfWeek: date.getDay(),
      isToday: isSameDay(date, today),
      isCurrentMonth: false,
      availability: availabilityMap.get(dateStr),
    })
  }

  // Add days of current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDateString(date)

    currentWeek.push({
      date: dateStr,
      dayOfWeek: date.getDay(),
      isToday: isSameDay(date, today),
      isCurrentMonth: true,
      availability: availabilityMap.get(dateStr),
    })

    if (currentWeek.length === 7) {
      weeks.push({ weekNumber, days: currentWeek })
      currentWeek = []
      weekNumber++
    }
  }

  // Add days from next month to fill last week
  if (currentWeek.length > 0) {
    const daysToAdd = 7 - currentWeek.length
    for (let i = 1; i <= daysToAdd; i++) {
      const date = new Date(year, month + 1, i)
      const dateStr = formatDateString(date)
      currentWeek.push({
        date: dateStr,
        dayOfWeek: date.getDay(),
        isToday: isSameDay(date, today),
        isCurrentMonth: false,
        availability: availabilityMap.get(dateStr),
      })
    }
    weeks.push({ weekNumber, days: currentWeek })
  }

  return { year, month, weeks }
}

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}
