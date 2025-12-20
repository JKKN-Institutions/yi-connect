/**
 * Email Service
 *
 * Centralized email sending functionality.
 * Currently uses console.log for development.
 * Can be extended to use services like Resend, SendGrid, etc.
 */

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface InvitationEmailOptions {
  to: string;
  inviterName: string;
  inviteeName?: string;
  chapterName?: string;
  roleName?: string;
  signUpUrl: string;
  notes?: string;
}

/**
 * Send a generic email
 * @param options Email options
 * @returns Success status
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, integrate with email service like Resend, SendGrid, etc.
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'Yi Connect <noreply@yiconnect.org>',
    //   to: options.to,
    //   subject: options.subject,
    //   text: options.text,
    //   html: options.html,
    // });

    // For now, log the email (development mode)
    console.log('📧 Email would be sent:');
    console.log('  To:', options.to);
    console.log('  Subject:', options.subject);
    console.log('  Text:', options.text.substring(0, 100) + '...');

    return { success: true };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send an invitation email to a new user
 * @param options Invitation email options
 * @returns Success status
 */
export async function sendInvitationEmail(options: InvitationEmailOptions): Promise<{ success: boolean; error?: string }> {
  const {
    to,
    inviterName,
    inviteeName,
    chapterName,
    roleName,
    signUpUrl,
    notes,
  } = options;

  const greeting = inviteeName ? `Dear ${inviteeName},` : 'Hello,';
  const chapterInfo = chapterName ? ` to join ${chapterName}` : '';
  const roleInfo = roleName ? ` as a ${roleName}` : '';

  const textContent = `
${greeting}

You have been invited by ${inviterName}${chapterInfo}${roleInfo} to join Yi Connect - the Yi Chapter Management System.

Yi Connect helps Yi chapters manage members, events, finances, and communications all in one place.

To get started, please sign up using this email address (${to}) at:
${signUpUrl}

${notes ? `Additional notes from ${inviterName}:\n${notes}\n` : ''}
If you have any questions, please reach out to your chapter administrator.

Best regards,
The Yi Connect Team

---
This is an automated message from Yi Connect.
If you did not expect this invitation, you can safely ignore this email.
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Yi Connect</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Yi Connect</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You're Invited!</p>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="margin-top: 0;">${greeting}</p>

    <p>You have been invited by <strong>${inviterName}</strong>${chapterInfo}${roleInfo} to join <strong>Yi Connect</strong> - the Yi Chapter Management System.</p>

    <p>Yi Connect helps Yi chapters manage members, events, finances, and communications all in one place.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${signUpUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Sign Up Now
      </a>
    </div>

    <p style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 14px;">
      <strong>Sign up with:</strong> ${to}
    </p>

    ${notes ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Note from ${inviterName}:</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 14px;">${notes}</p>
    </div>
    ` : ''}

    <p>If you have any questions, please reach out to your chapter administrator.</p>

    <p style="margin-bottom: 0;">Best regards,<br><strong>The Yi Connect Team</strong></p>
  </div>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 12px; color: #6b7280;">
    <p style="margin: 0;">This is an automated message from Yi Connect.</p>
    <p style="margin: 10px 0 0 0;">If you did not expect this invitation, you can safely ignore this email.</p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to,
    subject: `You're invited to join Yi Connect${chapterName ? ` - ${chapterName}` : ''}`,
    text: textContent,
    html: htmlContent,
  });
}
