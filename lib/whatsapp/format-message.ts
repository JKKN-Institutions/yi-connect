/**
 * WhatsApp Message Templates for Yi Connect Events
 *
 * WhatsApp supports basic formatting:
 * *bold*, _italic_, ~strikethrough~, ```monospace```
 */

export interface EventDetails {
  title: string;
  date: string; // Formatted date string
  time: string; // Formatted time string
  venue: string;
  description?: string;
  eventUrl?: string;
}

export interface MemberDetails {
  name: string;
  phoneNumber: string;
}

/**
 * Event Created Notification
 */
export function formatEventCreated(event: EventDetails, chapterName: string = 'Yi Erode'): string {
  return `*New Event Alert!* 🎯

*${event.title}*

📅 *Date:* ${event.date}
⏰ *Time:* ${event.time}
📍 *Venue:* ${event.venue}
${event.description ? `\n📝 ${event.description}\n` : ''}
${event.eventUrl ? `🔗 Details: ${event.eventUrl}\n` : ''}
Please RSVP at your earliest convenience.

_${chapterName} - Together We Can. We Will._`;
}

/**
 * RSVP Confirmation
 */
export function formatRsvpConfirmation(
  member: MemberDetails,
  event: EventDetails,
  rsvpStatus: 'attending' | 'not_attending' | 'maybe'
): string {
  const statusEmoji = {
    attending: '✅',
    not_attending: '❌',
    maybe: '🤔'
  };

  const statusText = {
    attending: 'confirmed your attendance',
    not_attending: 'indicated you cannot attend',
    maybe: 'marked as maybe attending'
  };

  return `*RSVP Confirmation* ${statusEmoji[rsvpStatus]}

Hi ${member.name},

You have ${statusText[rsvpStatus]} for:

*${event.title}*
📅 ${event.date} at ${event.time}
📍 ${event.venue}
${event.eventUrl ? `\n🔗 Event Details: ${event.eventUrl}` : ''}

Thank you for your response!

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Event Reminder (3 days before)
 */
export function formatEventReminder3Days(event: EventDetails, memberName: string): string {
  return `*Event Reminder* 🔔

Hi ${memberName},

Just a reminder that *${event.title}* is happening in *3 days*!

📅 *Date:* ${event.date}
⏰ *Time:* ${event.time}
📍 *Venue:* ${event.venue}
${event.eventUrl ? `\n🔗 Details: ${event.eventUrl}` : ''}

Looking forward to seeing you there!

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Event Reminder (1 day before)
 */
export function formatEventReminder1Day(event: EventDetails, memberName: string): string {
  return `*Tomorrow's Event!* 🌟

Hi ${memberName},

*${event.title}* is *TOMORROW*!

📅 *Date:* ${event.date}
⏰ *Time:* ${event.time}
📍 *Venue:* ${event.venue}
${event.eventUrl ? `\n🔗 Details: ${event.eventUrl}` : ''}

See you there!

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Event Reminder (Day of event)
 */
export function formatEventReminderToday(event: EventDetails, memberName: string): string {
  return `*Today's Event!* 🎉

Hi ${memberName},

*${event.title}* is *TODAY*!

⏰ *Time:* ${event.time}
📍 *Venue:* ${event.venue}
${event.eventUrl ? `\n🔗 Details: ${event.eventUrl}` : ''}

See you soon!

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Event Cancellation
 */
export function formatEventCancellation(event: EventDetails, reason?: string): string {
  return `*Event Cancelled* ❌

We regret to inform you that the following event has been cancelled:

*${event.title}*
📅 Originally scheduled: ${event.date}
${reason ? `\n📝 Reason: ${reason}` : ''}

We apologize for any inconvenience caused.

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Event Update/Change
 */
export function formatEventUpdate(
  event: EventDetails,
  changes: { field: string; oldValue: string; newValue: string }[]
): string {
  const changesList = changes
    .map(c => `• *${c.field}:* ${c.oldValue} → ${c.newValue}`)
    .join('\n');

  return `*Event Update* 📝

The following event has been updated:

*${event.title}*

*Changes:*
${changesList}

*Updated Details:*
📅 ${event.date}
⏰ ${event.time}
📍 ${event.venue}
${event.eventUrl ? `\n🔗 Details: ${event.eventUrl}` : ''}

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Post-Event Thank You
 */
export function formatPostEventThankYou(event: EventDetails, memberName: string): string {
  return `*Thank You!* 🙏

Hi ${memberName},

Thank you for attending *${event.title}*!

Your participation made the event a success. We hope you found it valuable.

We'd love your feedback! Please take a moment to share your thoughts.

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Volunteer Assignment
 */
export function formatVolunteerAssignment(
  event: EventDetails,
  memberName: string,
  role: string
): string {
  return `*Volunteer Assignment* 🤝

Hi ${memberName},

You have been assigned as *${role}* for:

*${event.title}*
📅 ${event.date}
⏰ ${event.time}
📍 ${event.venue}

Thank you for volunteering! Please confirm your availability.
${event.eventUrl ? `\n🔗 Event Details: ${event.eventUrl}` : ''}

_Yi Erode - Together We Can. We Will._`;
}

/**
 * Generic announcement
 */
export function formatAnnouncement(
  title: string,
  body: string,
  chapterName: string = 'Yi Erode'
): string {
  return `*${title}*

${body}

_${chapterName} - Together We Can. We Will._`;
}

/**
 * Quick RSVP WhatsApp Message
 * Optimized for WhatsApp sharing with RSVP link
 */
export function formatQuickRSVPMessage(
  event: EventDetails,
  rsvpUrl: string,
  attendeeCount: number,
  chapterName: string = 'Yi Erode'
): string {
  let message = `*${event.title}*\n\n`;

  message += `📅 ${event.date}\n`;
  message += `⏰ ${event.time}\n`;

  if (event.venue) {
    message += `📍 ${event.venue}\n`;
  }

  message += `\n✅ *${attendeeCount} attending* so far\n`;
  message += `\n👉 *Tap your name to RSVP:*\n${rsvpUrl}\n`;
  message += `\n_No login needed. Just tap and you're in._\n`;
  message += `\n_${chapterName} — Together We Can. We Will._`;

  return message;
}
