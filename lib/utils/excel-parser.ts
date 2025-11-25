/**
 * Excel Parser Utility
 *
 * Parses Excel files (.xlsx, .xls) for bulk member uploads.
 * Provides validation and data transformation.
 */

import * as XLSX from 'xlsx'

// Expected column headers mapping to member fields
export const MEMBER_COLUMN_MAPPING: Record<string, string> = {
  // Basic Info
  'email': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'full name': 'full_name',
  'name': 'full_name',
  'member name': 'full_name',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'mobile number': 'phone',

  // Professional Info
  'company': 'company',
  'company name': 'company',
  'organization': 'company',
  'designation': 'designation',
  'job title': 'designation',
  'position': 'designation',
  'industry': 'industry',
  'sector': 'industry',
  'years of experience': 'years_of_experience',
  'experience': 'years_of_experience',
  'experience (years)': 'years_of_experience',
  'linkedin': 'linkedin_url',
  'linkedin url': 'linkedin_url',
  'linkedin profile': 'linkedin_url',

  // Personal Info
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birth date': 'date_of_birth',
  'gender': 'gender',
  'address': 'address',
  'street address': 'address',
  'city': 'city',
  'state': 'state',
  'province': 'state',
  'pincode': 'pincode',
  'zip': 'pincode',
  'zip code': 'pincode',
  'postal code': 'pincode',
  'country': 'country',

  // Emergency Contact
  'emergency contact': 'emergency_contact_name',
  'emergency contact name': 'emergency_contact_name',
  'emergency phone': 'emergency_contact_phone',
  'emergency contact phone': 'emergency_contact_phone',
  'emergency relationship': 'emergency_contact_relationship',
  'emergency contact relationship': 'emergency_contact_relationship',

  // Membership
  'membership number': 'membership_number',
  'member id': 'membership_number',
  'member since': 'member_since',
  'join date': 'member_since',
  'membership status': 'membership_status',
  'status': 'membership_status',

  // Chapter
  'chapter': 'chapter_name',
  'chapter name': 'chapter_name',
  'yi chapter': 'chapter_name',
}

export interface ParsedMemberRow {
  rowNumber: number
  data: Record<string, any>
  errors: string[]
  warnings: string[]
  isValid: boolean
}

export interface ParseResult {
  success: boolean
  data: ParsedMemberRow[]
  totalRows: number
  validRows: number
  invalidRows: number
  headers: string[]
  mappedHeaders: Record<string, string>
  unmappedHeaders: string[]
  error?: string
}

/**
 * Parse Excel file and extract member data
 */
export function parseExcelFile(buffer: ArrayBuffer): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        headers: [],
        mappedHeaders: {},
        unmappedHeaders: [],
        error: 'No sheets found in the Excel file'
      }
    }

    const worksheet = workbook.Sheets[sheetName]

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd'
    }) as any[][]

    if (jsonData.length < 2) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        headers: [],
        mappedHeaders: {},
        unmappedHeaders: [],
        error: 'File must have a header row and at least one data row'
      }
    }

    // Extract and normalize headers
    const rawHeaders = jsonData[0].map(h => String(h || '').trim())
    const { mappedHeaders, unmappedHeaders } = mapHeaders(rawHeaders)

    // Parse data rows
    const parsedData: ParsedMemberRow[] = []
    let validCount = 0
    let invalidCount = 0

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i]

      // Skip completely empty rows
      if (!row || row.every(cell => !cell)) continue

      const parsedRow = parseRow(row, rawHeaders, mappedHeaders, i + 1)
      parsedData.push(parsedRow)

      if (parsedRow.isValid) {
        validCount++
      } else {
        invalidCount++
      }
    }

    return {
      success: true,
      data: parsedData,
      totalRows: parsedData.length,
      validRows: validCount,
      invalidRows: invalidCount,
      headers: rawHeaders,
      mappedHeaders,
      unmappedHeaders
    }
  } catch (error: any) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      headers: [],
      mappedHeaders: {},
      unmappedHeaders: [],
      error: `Failed to parse Excel file: ${error.message}`
    }
  }
}

/**
 * Map raw headers to member fields
 */
function mapHeaders(headers: string[]): { mappedHeaders: Record<string, string>, unmappedHeaders: string[] } {
  const mappedHeaders: Record<string, string> = {}
  const unmappedHeaders: string[] = []

  headers.forEach((header, index) => {
    const normalizedHeader = header.toLowerCase().trim()
    const mappedField = MEMBER_COLUMN_MAPPING[normalizedHeader]

    if (mappedField) {
      mappedHeaders[header] = mappedField
    } else if (header) {
      unmappedHeaders.push(header)
    }
  })

  return { mappedHeaders, unmappedHeaders }
}

/**
 * Parse a single row and validate
 */
function parseRow(
  row: any[],
  headers: string[],
  mappedHeaders: Record<string, string>,
  rowNumber: number
): ParsedMemberRow {
  const data: Record<string, any> = {}
  const errors: string[] = []
  const warnings: string[] = []

  // Extract data based on mapped headers
  headers.forEach((header, index) => {
    const field = mappedHeaders[header]
    if (field && row[index] !== undefined && row[index] !== null && row[index] !== '') {
      let value = row[index]

      // Transform specific fields
      if (field === 'years_of_experience') {
        value = parseInt(value, 10)
        if (isNaN(value)) {
          warnings.push(`Years of experience "${row[index]}" is not a valid number`)
          value = null
        }
      } else if (field === 'date_of_birth' || field === 'member_since') {
        value = parseDate(value)
        if (!value) {
          warnings.push(`Date "${row[index]}" could not be parsed`)
        }
      } else if (field === 'gender') {
        value = normalizeGender(value)
      } else if (field === 'membership_status') {
        value = normalizeMembershipStatus(value)
      } else if (field === 'email') {
        value = String(value).toLowerCase().trim()
      } else if (typeof value === 'string') {
        value = value.trim()
      }

      data[field] = value
    }
  })

  // Validate required fields
  if (!data.email) {
    errors.push('Email is required')
  } else if (!isValidEmail(data.email)) {
    errors.push(`Invalid email format: ${data.email}`)
  }

  if (!data.full_name) {
    errors.push('Full name is required')
  }

  // Validate optional fields
  if (data.phone && !isValidPhone(data.phone)) {
    warnings.push(`Phone number "${data.phone}" may not be valid`)
  }

  if (data.linkedin_url && !isValidUrl(data.linkedin_url)) {
    warnings.push(`LinkedIn URL "${data.linkedin_url}" is not a valid URL`)
  }

  if (data.pincode && !/^\d{6}$/.test(data.pincode)) {
    warnings.push(`Pincode "${data.pincode}" should be 6 digits`)
  }

  return {
    rowNumber,
    data,
    errors,
    warnings,
    isValid: errors.length === 0
  }
}

/**
 * Parse date from various formats
 */
function parseDate(value: any): string | null {
  if (!value) return null

  // If it's already a Date object
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  // Try parsing string date
  const dateStr = String(value).trim()

  // Common date formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY or MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ]

  for (const format of formats) {
    const match = dateStr.match(format)
    if (match) {
      try {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]
        }
      } catch {
        continue
      }
    }
  }

  // Try JavaScript's Date parsing as fallback
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    return null
  }

  return null
}

/**
 * Normalize gender values
 */
function normalizeGender(value: any): string | null {
  if (!value) return null

  const normalized = String(value).toLowerCase().trim()

  if (['m', 'male', 'man'].includes(normalized)) return 'male'
  if (['f', 'female', 'woman'].includes(normalized)) return 'female'
  if (['o', 'other', 'others'].includes(normalized)) return 'other'
  if (['prefer not to say', 'prefer_not_to_say', 'not specified'].includes(normalized)) return 'prefer_not_to_say'

  return null
}

/**
 * Normalize membership status
 */
function normalizeMembershipStatus(value: any): string {
  if (!value) return 'active'

  const normalized = String(value).toLowerCase().trim()

  if (['active', 'a'].includes(normalized)) return 'active'
  if (['inactive', 'i'].includes(normalized)) return 'inactive'
  if (['suspended', 's'].includes(normalized)) return 'suspended'
  if (['alumni', 'alumnus', 'alumna'].includes(normalized)) return 'alumni'

  return 'active'
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone format (basic)
 */
function isValidPhone(phone: string): boolean {
  // Allow various phone formats
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
  const cleanPhone = String(phone).replace(/\s/g, '')
  return phoneRegex.test(cleanPhone) || cleanPhone.length >= 10
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('linkedin.com')
  }
}

/**
 * Generate Excel template for bulk upload
 */
export function generateTemplate(): ArrayBuffer {
  const headers = [
    'Email',
    'Full Name',
    'Phone',
    'Company',
    'Designation',
    'Industry',
    'Years of Experience',
    'LinkedIn URL',
    'Date of Birth',
    'Gender',
    'Address',
    'City',
    'State',
    'Pincode',
    'Country',
    'Emergency Contact Name',
    'Emergency Contact Phone',
    'Emergency Contact Relationship',
    'Chapter',
    'Membership Number',
    'Member Since',
    'Membership Status'
  ]

  const sampleData = [
    'john.doe@gmail.com',
    'John Doe',
    '+91 9876543210',
    'Acme Corporation',
    'Software Engineer',
    'Technology',
    '5',
    'https://linkedin.com/in/johndoe',
    '1990-01-15',
    'Male',
    '123 Main Street',
    'Erode',
    'Tamil Nadu',
    '638001',
    'India',
    'Jane Doe',
    '+91 9876543211',
    'Spouse',
    'Yi Erode', // Chapter name - leave empty to use default chapter
    'YI-2024-001',
    '2024-01-01',
    'Active'
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleData])

  // Set column widths
  worksheet['!cols'] = headers.map(() => ({ wch: 20 }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
}
