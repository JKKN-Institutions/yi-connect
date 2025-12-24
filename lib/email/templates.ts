/**
 * Email Templates for Yi Connect
 *
 * All email templates are defined here for consistency
 */

const LOGO_URL = 'https://yi-connect-app.vercel.app/yi-logo.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yi-connect-app.vercel.app'

// Base email wrapper with Yi branding
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yi Connect</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Yi Connect</h1>
              <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Young Indians • Nation Building</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">
                This email was sent by Yi Connect<br>
                <a href="${APP_URL}" style="color: #3b82f6; text-decoration: none;">yi-connect-app.vercel.app</a>
              </p>
              <p style="color: #94a3b8; margin: 12px 0 0; font-size: 11px;">
                Together We Can. We Will.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// Button component
function button(text: string, url: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 24px 0;">
      <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${text}
      </a>
    </td>
  </tr>
</table>
`
}

// ============================================================================
// MEMBER TEMPLATES
// ============================================================================

export function memberApprovalEmail(data: {
  memberName: string
  chapterName: string
}): { subject: string; html: string } {
  return {
    subject: `Welcome to Yi ${data.chapterName}! 🎉`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Congratulations, ${data.memberName}!</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Your membership application for <strong>Yi ${data.chapterName}</strong> has been approved!
        You are now officially part of the Young Indians community.
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        As a member, you can:
      </p>
      <ul style="color: #475569; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
        <li>Participate in chapter events and activities</li>
        <li>Connect with fellow entrepreneurs</li>
        <li>Contribute to nation-building initiatives</li>
        <li>Access exclusive Yi resources</li>
      </ul>
      ${button('Access Yi Connect', APP_URL)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Together We Can. We Will.
      </p>
    `),
  }
}

export function memberRejectionEmail(data: {
  memberName: string
  chapterName: string
  reason?: string
}): { subject: string; html: string } {
  return {
    subject: `Update on Your Yi ${data.chapterName} Application`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${data.memberName},</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Thank you for your interest in joining Yi ${data.chapterName}. After careful review,
        we regret to inform you that your application has not been approved at this time.
      </p>
      ${data.reason ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0;">
        <p style="color: #475569; margin: 0; font-size: 14px;"><strong>Reason:</strong> ${data.reason}</p>
      </div>
      ` : ''}
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        If you have questions or would like to discuss this further, please reach out to the chapter leadership.
      </p>
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        We appreciate your interest in Young Indians.
      </p>
    `),
  }
}

export function memberInvitationEmail(data: {
  inviterName: string
  chapterName: string
  inviteLink: string
}): { subject: string; html: string } {
  return {
    subject: `You're Invited to Join Yi ${data.chapterName}!`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">You've Been Invited!</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        <strong>${data.inviterName}</strong> has invited you to join <strong>Yi ${data.chapterName}</strong>.
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Young Indians is a network of young entrepreneurs and professionals committed to nation building.
        As a member, you'll have access to networking events, skill development programs, and the opportunity
        to contribute to meaningful social impact initiatives.
      </p>
      ${button('Accept Invitation', data.inviteLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        This invitation will expire in 7 days.
      </p>
    `),
  }
}

// ============================================================================
// EVENT TEMPLATES
// ============================================================================

export function eventRegistrationEmail(data: {
  memberName: string
  eventTitle: string
  eventDate: string
  eventVenue: string
  eventLink: string
}): { subject: string; html: string } {
  return {
    subject: `Registration Confirmed: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">You're Registered! 🎫</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, your registration for the following event has been confirmed:
      </p>
      <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #1e40af; margin: 0 0 12px; font-size: 18px;">${data.eventTitle}</h3>
        <p style="color: #475569; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.eventDate}
        </p>
        <p style="color: #475569; margin: 0; font-size: 14px;">
          📍 <strong>Venue:</strong> ${data.eventVenue}
        </p>
      </div>
      ${button('View Event Details', data.eventLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Add this event to your calendar and we'll see you there!
      </p>
    `),
  }
}

export function eventCancellationEmail(data: {
  memberName: string
  eventTitle: string
  reason?: string
}): { subject: string; html: string } {
  return {
    subject: `Event Cancelled: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Event Cancelled</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, we regret to inform you that the following event has been cancelled:
      </p>
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #dc2626; margin: 0; font-size: 18px;">${data.eventTitle}</h3>
      </div>
      ${data.reason ? `
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        <strong>Reason:</strong> ${data.reason}
      </p>
      ` : ''}
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        We apologize for any inconvenience. Please check Yi Connect for upcoming events.
      </p>
      ${button('Browse Events', `${APP_URL}/events`)}
    `),
  }
}

export function eventReminderEmail(data: {
  memberName: string
  eventTitle: string
  eventDate: string
  eventVenue: string
  eventLink: string
}): { subject: string; html: string } {
  return {
    subject: `Reminder: ${data.eventTitle} is Tomorrow!`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Event Reminder ⏰</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, just a friendly reminder about tomorrow's event:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #92400e; margin: 0 0 12px; font-size: 18px;">${data.eventTitle}</h3>
        <p style="color: #78350f; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.eventDate}
        </p>
        <p style="color: #78350f; margin: 0; font-size: 14px;">
          📍 <strong>Venue:</strong> ${data.eventVenue}
        </p>
      </div>
      ${button('View Event Details', data.eventLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        We look forward to seeing you!
      </p>
    `),
  }
}

export function volunteerAssignmentEmail(data: {
  memberName: string
  eventTitle: string
  role: string
  eventDate: string
  eventLink: string
}): { subject: string; html: string } {
  return {
    subject: `Volunteer Assignment: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">You've Been Assigned as a Volunteer! 🙌</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, you've been assigned to help with an upcoming event:
      </p>
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #166534; margin: 0 0 12px; font-size: 18px;">${data.eventTitle}</h3>
        <p style="color: #166534; margin: 0 0 8px; font-size: 14px;">
          🎯 <strong>Your Role:</strong> ${data.role}
        </p>
        <p style="color: #166534; margin: 0; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.eventDate}
        </p>
      </div>
      ${button('View Assignment Details', data.eventLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Thank you for volunteering! Your contribution makes a difference.
      </p>
    `),
  }
}

// ============================================================================
// TRAINER TEMPLATES
// ============================================================================

export function trainerAssignmentEmail(data: {
  trainerName: string
  eventTitle: string
  sessionTopic: string
  eventDate: string
  eventVenue: string
  eventLink: string
}): { subject: string; html: string } {
  return {
    subject: `Training Assignment: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Training Assignment</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.trainerName}, you've been assigned as a trainer for an upcoming session:
      </p>
      <div style="background-color: #faf5ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #7c3aed; margin: 0 0 12px; font-size: 18px;">${data.eventTitle}</h3>
        <p style="color: #6d28d9; margin: 0 0 8px; font-size: 14px;">
          📚 <strong>Topic:</strong> ${data.sessionTopic}
        </p>
        <p style="color: #6d28d9; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.eventDate}
        </p>
        <p style="color: #6d28d9; margin: 0; font-size: 14px;">
          📍 <strong>Venue:</strong> ${data.eventVenue}
        </p>
      </div>
      ${button('View Session Details', data.eventLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Please prepare your materials and confirm your availability.
      </p>
    `),
  }
}

// ============================================================================
// INDUSTRIAL VISIT TEMPLATES
// ============================================================================

export function ivBookingConfirmationEmail(data: {
  memberName: string
  industryName: string
  visitDate: string
  visitTime: string
  address: string
}): { subject: string; html: string } {
  return {
    subject: `Industrial Visit Confirmed: ${data.industryName}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Visit Confirmed! 🏭</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, your industrial visit has been confirmed:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #059669; margin: 0 0 12px; font-size: 18px;">${data.industryName}</h3>
        <p style="color: #047857; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.visitDate}
        </p>
        <p style="color: #047857; margin: 0 0 8px; font-size: 14px;">
          ⏰ <strong>Time:</strong> ${data.visitTime}
        </p>
        <p style="color: #047857; margin: 0; font-size: 14px;">
          📍 <strong>Address:</strong> ${data.address}
        </p>
      </div>
      ${button('View Booking Details', `${APP_URL}/industrial-visits/my-bookings`)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Please arrive 15 minutes before the scheduled time.
      </p>
    `),
  }
}

export function ivWaitlistPromotionEmail(data: {
  memberName: string
  industryName: string
  visitDate: string
  confirmByDate: string
}): { subject: string; html: string } {
  return {
    subject: `Spot Available: ${data.industryName} Industrial Visit`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Good News! A Spot Opened Up 🎉</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, a spot has opened up for the industrial visit you were waitlisted for:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #92400e; margin: 0 0 12px; font-size: 18px;">${data.industryName}</h3>
        <p style="color: #78350f; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Visit Date:</strong> ${data.visitDate}
        </p>
        <p style="color: #dc2626; margin: 0; font-size: 14px; font-weight: 600;">
          ⚠️ <strong>Confirm by:</strong> ${data.confirmByDate}
        </p>
      </div>
      ${button('Confirm My Spot', `${APP_URL}/industrial-visits/my-bookings`)}
      <p style="color: #dc2626; font-size: 14px; margin: 16px 0 0; font-weight: 500;">
        Please confirm within 24 hours or your spot will be offered to the next person on the waitlist.
      </p>
    `),
  }
}

// ============================================================================
// MATERIAL REVIEW TEMPLATES
// ============================================================================

export function materialSubmittedEmail(data: {
  reviewerName: string
  uploaderName: string
  eventTitle: string
  materialType: string
  reviewLink: string
}): { subject: string; html: string } {
  return {
    subject: `Material Review Required: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Material Submitted for Review</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.reviewerName}, a new material has been submitted for your review:
      </p>
      <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="color: #1e40af; margin: 0 0 8px; font-size: 14px;">
          📄 <strong>Type:</strong> ${data.materialType}
        </p>
        <p style="color: #1e40af; margin: 0 0 8px; font-size: 14px;">
          🎯 <strong>Event:</strong> ${data.eventTitle}
        </p>
        <p style="color: #1e40af; margin: 0; font-size: 14px;">
          👤 <strong>Submitted by:</strong> ${data.uploaderName}
        </p>
      </div>
      ${button('Review Material', data.reviewLink)}
    `),
  }
}

export function materialApprovedEmail(data: {
  uploaderName: string
  eventTitle: string
  materialType: string
}): { subject: string; html: string } {
  return {
    subject: `Material Approved: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Material Approved ✅</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.uploaderName}, great news! Your submitted material has been approved:
      </p>
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="color: #166534; margin: 0 0 8px; font-size: 14px;">
          📄 <strong>Type:</strong> ${data.materialType}
        </p>
        <p style="color: #166534; margin: 0; font-size: 14px;">
          🎯 <strong>Event:</strong> ${data.eventTitle}
        </p>
      </div>
      <p style="color: #475569; line-height: 1.6; margin: 16px 0 0;">
        Thank you for your contribution!
      </p>
    `),
  }
}

export function materialRejectedEmail(data: {
  uploaderName: string
  eventTitle: string
  materialType: string
  reason: string
}): { subject: string; html: string } {
  return {
    subject: `Material Needs Revision: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Material Needs Revision</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.uploaderName}, your submitted material requires some changes:
      </p>
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="color: #dc2626; margin: 0 0 8px; font-size: 14px;">
          📄 <strong>Type:</strong> ${data.materialType}
        </p>
        <p style="color: #dc2626; margin: 0 0 12px; font-size: 14px;">
          🎯 <strong>Event:</strong> ${data.eventTitle}
        </p>
        <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
          <strong>Feedback:</strong> ${data.reason}
        </p>
      </div>
      ${button('Revise & Resubmit', `${APP_URL}/events`)}
    `),
  }
}

// ============================================================================
// ADMIN NOTIFICATION TEMPLATES
// ============================================================================

export function adminNewIVSlotEmail(data: {
  adminName: string
  industryName: string
  slotTitle: string
  slotDate: string
  capacity: number
  manageLink: string
}): { subject: string; html: string } {
  return {
    subject: `New IV Slot Created by ${data.industryName}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">New Industrial Visit Slot 🏭</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.adminName}, a new industrial visit slot has been created by an industry partner:
      </p>
      <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #1e40af; margin: 0 0 12px; font-size: 18px;">${data.slotTitle}</h3>
        <p style="color: #1e40af; margin: 0 0 8px; font-size: 14px;">
          🏢 <strong>Industry:</strong> ${data.industryName}
        </p>
        <p style="color: #1e40af; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Date:</strong> ${data.slotDate}
        </p>
        <p style="color: #1e40af; margin: 0; font-size: 14px;">
          👥 <strong>Capacity:</strong> ${data.capacity} members
        </p>
      </div>
      ${button('Review Slot', data.manageLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        This slot is now visible to chapter members for booking.
      </p>
    `),
  }
}

export function ivRequestNotificationEmail(data: {
  adminName: string
  requesterName: string
  requesterEmail: string
  industryName: string
  preferredDates: string
  learningOutcomes: string
  estimatedParticipants: number
  additionalNotes?: string
}): { subject: string; html: string } {
  return {
    subject: `New IV Request from ${data.requesterName}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">New Industrial Visit Request 📋</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.adminName}, a member has submitted a new industrial visit request:
      </p>
      <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="color: #92400e; margin: 0 0 8px; font-size: 14px;">
          👤 <strong>Requested by:</strong> ${data.requesterName} (${data.requesterEmail})
        </p>
        <p style="color: #92400e; margin: 0 0 8px; font-size: 14px;">
          🏢 <strong>Industry:</strong> ${data.industryName}
        </p>
        <p style="color: #92400e; margin: 0 0 8px; font-size: 14px;">
          📅 <strong>Preferred Dates:</strong> ${data.preferredDates}
        </p>
        <p style="color: #92400e; margin: 0 0 8px; font-size: 14px;">
          👥 <strong>Estimated Participants:</strong> ${data.estimatedParticipants}
        </p>
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          🎯 <strong>Learning Outcomes:</strong> ${data.learningOutcomes}
        </p>
        ${data.additionalNotes ? `
        <p style="color: #78350f; margin: 12px 0 0; font-size: 14px; font-style: italic;">
          💬 "${data.additionalNotes}"
        </p>
        ` : ''}
      </div>
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Please review this request and follow up with the industry partner.
      </p>
    `),
  }
}

export function waitlistCapacityNotificationEmail(data: {
  memberName: string
  eventTitle: string
  industryName: string
  newCapacity: number
  currentPosition: number
  bookingLink: string
}): { subject: string; html: string } {
  return {
    subject: `Capacity Increased: ${data.eventTitle}`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Good News! More Spots Available 🎉</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName}, the capacity has been increased for an event you're waitlisted for:
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <h3 style="color: #059669; margin: 0 0 12px; font-size: 18px;">${data.eventTitle}</h3>
        <p style="color: #047857; margin: 0 0 8px; font-size: 14px;">
          🏢 <strong>Industry:</strong> ${data.industryName}
        </p>
        <p style="color: #047857; margin: 0 0 8px; font-size: 14px;">
          👥 <strong>New Capacity:</strong> ${data.newCapacity} members
        </p>
        <p style="color: #047857; margin: 0; font-size: 14px;">
          📊 <strong>Your Position:</strong> #${data.currentPosition} on waitlist
        </p>
      </div>
      ${button('Check Your Status', data.bookingLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        If spots are still available, you may be able to confirm your booking now.
      </p>
    `),
  }
}

// ============================================================================
// INDUSTRY PORTAL TEMPLATES
// ============================================================================

export function industryPortalInviteEmail(data: {
  userName: string
  industryName: string
  role: string
  inviteLink: string
}): { subject: string; html: string } {
  return {
    subject: `You're Invited to the Yi Industry Portal`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Industry Portal Access 🏭</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.userName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        You've been invited to access the Yi Connect Industry Portal on behalf of <strong>${data.industryName}</strong>.
      </p>
      <div style="background-color: #ecfdf5; border-radius: 8px; padding: 20px; margin: 16px 0;">
        <p style="color: #047857; margin: 0 0 8px; font-size: 14px;">
          🏢 <strong>Organization:</strong> ${data.industryName}
        </p>
        <p style="color: #047857; margin: 0; font-size: 14px;">
          👤 <strong>Role:</strong> ${data.role}
        </p>
      </div>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Through the Industry Portal, you can:
      </p>
      <ul style="color: #475569; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
        <li>Create and manage industrial visit slots</li>
        <li>View and track visit bookings</li>
        <li>Communicate with Yi chapter coordinators</li>
        <li>Update your organization's profile</li>
      </ul>
      ${button('Access Industry Portal', data.inviteLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        If you didn't expect this invitation, please ignore this email.
      </p>
    `),
  }
}

// ============================================================================
// CHAPTER INVITATION TEMPLATE
// ============================================================================

export function chapterChairInviteEmail(data: {
  inviteeName: string
  chapterName: string
  inviterName: string
  acceptLink: string
}): { subject: string; html: string } {
  return {
    subject: `You're Invited to Lead Yi ${data.chapterName}!`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Leadership Invitation 🏆</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.inviteeName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        <strong>${data.inviterName}</strong> has invited you to serve as the <strong>Chapter Chair</strong>
        of <strong>Yi ${data.chapterName}</strong>.
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        As Chapter Chair, you will:
      </p>
      <ul style="color: #475569; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
        <li>Lead the chapter's strategic direction</li>
        <li>Oversee all chapter activities and initiatives</li>
        <li>Manage the executive committee</li>
        <li>Represent the chapter at regional and national levels</li>
      </ul>
      ${button('Accept Invitation', data.acceptLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        This invitation will expire in 7 days.
      </p>
    `),
  }
}

// ============================================================================
// OPPORTUNITY APPLICATION TEMPLATES
// ============================================================================

export function opportunityApplicationAcceptedEmail(data: {
  applicantName: string
  opportunityTitle: string
  industryName: string
  reviewerNotes?: string
  viewLink: string
}): { subject: string; html: string } {
  return {
    subject: `🎉 Congratulations! Your Application for "${data.opportunityTitle}" Has Been Accepted`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Application Accepted! 🎉</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.applicantName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Great news! Your application for <strong>"${data.opportunityTitle}"</strong> at
        <strong>${data.industryName}</strong> has been <span style="color: #16a34a; font-weight: 600;">accepted</span>.
      </p>
      ${data.reviewerNotes ? `
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #166534; margin: 0; font-size: 14px;"><strong>Message from reviewer:</strong></p>
        <p style="color: #166534; margin: 8px 0 0; font-size: 14px;">${data.reviewerNotes}</p>
      </div>
      ` : ''}
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Please check the opportunity details for next steps and further instructions.
      </p>
      ${button('View Details', data.viewLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        If you have any questions, please reach out to the opportunity coordinator.
      </p>
    `),
  }
}

export function opportunityApplicationDeclinedEmail(data: {
  applicantName: string
  opportunityTitle: string
  industryName: string
  reviewerNotes?: string
  exploreLink: string
}): { subject: string; html: string } {
  return {
    subject: `Update on Your Application for "${data.opportunityTitle}"`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Application Update</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.applicantName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Thank you for your interest in <strong>"${data.opportunityTitle}"</strong> at
        <strong>${data.industryName}</strong>.
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        After careful review, we regret to inform you that your application was not selected at this time.
      </p>
      ${data.reviewerNotes ? `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Feedback:</strong></p>
        <p style="color: #92400e; margin: 8px 0 0; font-size: 14px;">${data.reviewerNotes}</p>
      </div>
      ` : ''}
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        We encourage you to explore other exciting opportunities available on Yi Connect.
      </p>
      ${button('Explore Opportunities', data.exploreLink)}
      <p style="color: #64748b; font-size: 14px; margin: 16px 0 0;">
        Thank you for being an active member of the Yi community!
      </p>
    `),
  }
}

export function opportunityApplicationShortlistedEmail(data: {
  applicantName: string
  opportunityTitle: string
  industryName: string
  reviewerNotes?: string
  viewLink: string
}): { subject: string; html: string } {
  return {
    subject: `📋 You've Been Shortlisted for "${data.opportunityTitle}"`,
    html: baseTemplate(`
      <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">You've Been Shortlisted! 📋</h2>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Dear ${data.applicantName},
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Your application for <strong>"${data.opportunityTitle}"</strong> at
        <strong>${data.industryName}</strong> has been <span style="color: #2563eb; font-weight: 600;">shortlisted</span>.
      </p>
      ${data.reviewerNotes ? `
      <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
        <p style="color: #1e40af; margin: 0; font-size: 14px;"><strong>Note from reviewer:</strong></p>
        <p style="color: #1e40af; margin: 8px 0 0; font-size: 14px;">${data.reviewerNotes}</p>
      </div>
      ` : ''}
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Please stay tuned for further updates. We may reach out with additional information soon.
      </p>
      ${button('View Application', data.viewLink)}
    `),
  }
}

// ============================================================================
// ANNOUNCEMENT TEMPLATES
// ============================================================================

export function announcementEmail(data: {
  memberName: string
  title: string
  content: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  chapterName: string
  viewLink?: string
}): { subject: string; html: string } {
  const priorityBadge = data.priority === 'urgent' || data.priority === 'high'
    ? `<span style="background-color: #dc2626; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-left: 8px;">${data.priority.toUpperCase()}</span>`
    : '';

  return {
    subject: `${data.priority === 'urgent' ? '[URGENT] ' : ''}${data.title} - ${data.chapterName}`,
    html: baseTemplate(`
      <h1 style="color: #1e293b; font-size: 24px; font-weight: 700; margin: 0 0 8px;">
        ${data.title}${priorityBadge}
      </h1>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">
        From ${data.chapterName}
      </p>
      <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
        Hi ${data.memberName},
      </p>
      <div style="color: #475569; line-height: 1.7; margin: 0 0 24px; white-space: pre-wrap;">
        ${data.content}
      </div>
      ${data.viewLink ? button('View in Yi Connect', data.viewLink) : ''}
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; text-align: center;">
        You received this because you are a member of ${data.chapterName}
      </p>
    `),
  }
}
