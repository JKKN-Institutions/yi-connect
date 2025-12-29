/**
 * Privacy Policy Page
 *
 * Required for Google Play Store submission.
 * Outlines data collection, usage, sharing, and user rights for Yi Connect.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Yi Connect',
  description: 'Privacy policy for Yi Connect Chapter Management System',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-4xl py-12 px-4">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">Last updated: December 29, 2025</p>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">

        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p>
            Yi Connect ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Yi Connect Chapter Management System mobile application and web platform (collectively, the "Service").
          </p>
          <p className="mt-2">
            By using Yi Connect, you agree to the collection and use of information in accordance with this policy.
          </p>
        </section>

        {/* Information We Collect */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">Personal Information</h3>
          <p>When you create an account and use Yi Connect, we collect:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Account Information:</strong> Email address, name, profile photo, phone number</li>
            <li><strong>Member Profile:</strong> Educational background, professional skills, interests, availability, leadership roles</li>
            <li><strong>Chapter Information:</strong> Yi Chapter affiliation, member ID, role within chapter</li>
            <li><strong>Event Data:</strong> Event RSVPs, attendance records (via QR check-in), volunteer hours, event participation</li>
            <li><strong>Financial Records:</strong> Budget information, expense submissions, reimbursement requests (for authorized users only)</li>
            <li><strong>Communication Data:</strong> Messages, announcements, feedback submissions</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">Automatically Collected Information</h3>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Device Information:</strong> Device ID, operating system, browser type, app version</li>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent on Service</li>
            <li><strong>Location Data:</strong> Approximate location for event check-in (if permission granted)</li>
            <li><strong>Push Notification Tokens:</strong> Device tokens for sending notifications</li>
          </ul>
        </section>

        {/* How We Use Your Information */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <p>We use the collected information for the following purposes:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Provide and Maintain the Service:</strong> Enable chapter management features, event coordination, member engagement tracking</li>
            <li><strong>Event Management:</strong> Process RSVPs, send event reminders, track attendance via QR check-in, assign volunteers</li>
            <li><strong>Communication:</strong> Send announcements, notifications, newsletters, and updates about chapter activities</li>
            <li><strong>Financial Management:</strong> Process budgets, track expenses, manage reimbursements and sponsorships</li>
            <li><strong>Leadership Tools:</strong> Facilitate succession planning, nomination tracking, award submissions</li>
            <li><strong>Analytics:</strong> Generate engagement reports, performance dashboards, chapter analytics</li>
            <li><strong>Improve the Service:</strong> Analyze usage patterns, fix bugs, develop new features</li>
            <li><strong>Security:</strong> Detect and prevent fraud, enforce terms of service, protect user accounts</li>
          </ul>
        </section>

        {/* Data Sharing and Disclosure */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Sharing and Disclosure</h2>

          <h3 className="text-xl font-semibold mb-3 mt-6">Within Your Yi Chapter</h3>
          <p>
            Your information is shared with other members of your Yi Chapter according to your role and permissions:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Chapter Members:</strong> Can view your name, profile photo, skills, and availability</li>
            <li><strong>Chapter Leaders:</strong> Can view engagement metrics, attendance records, volunteer hours</li>
            <li><strong>Finance Teams:</strong> Can view budget-related information (if authorized)</li>
            <li><strong>Event Coordinators:</strong> Can view RSVP status and check-in records</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">Service Providers</h3>
          <p>We share data with third-party service providers who assist us in operating the Service:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Supabase:</strong> Database hosting, authentication, real-time data sync</li>
            <li><strong>Vercel:</strong> Application hosting and content delivery</li>
            <li><strong>Google Firebase:</strong> Push notification delivery (Android only)</li>
          </ul>
          <p className="mt-2">
            These providers are contractually obligated to protect your data and use it only for the purposes we specify.
          </p>

          <h3 className="text-xl font-semibold mb-3 mt-6">National Yi Organization</h3>
          <p>
            With your chapter's consent, aggregated (non-personally identifiable) data may be shared with the National Yi organization for:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Benchmarking chapter performance</li>
            <li>National event coordination</li>
            <li>Leadership succession planning</li>
            <li>Best practices sharing</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-6">We Do NOT</h3>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>❌ Sell your personal information to third parties</li>
            <li>❌ Share your data with advertisers</li>
            <li>❌ Use your data for purposes unrelated to chapter management</li>
            <li>❌ Share your data with other chapters without your consent</li>
          </ul>
        </section>

        {/* Data Security */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
          <p>We implement industry-standard security measures to protect your information:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Encryption in Transit:</strong> All data transmitted between your device and our servers uses HTTPS/TLS encryption</li>
            <li><strong>Encryption at Rest:</strong> Database is encrypted at rest using AES-256 encryption</li>
            <li><strong>Row-Level Security (RLS):</strong> Database policies ensure users can only access data they're authorized to view</li>
            <li><strong>Authentication:</strong> Secure email/password authentication with optional magic link login</li>
            <li><strong>Role-Based Access Control:</strong> Permissions are enforced based on your chapter role</li>
          </ul>
          <p className="mt-4">
            <strong>Note:</strong> While we strive to protect your information, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security.
          </p>
        </section>

        {/* Data Retention */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
          <p>We retain your information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
            <li><strong>Inactive Accounts:</strong> Data may be retained for up to 1 year after last login for account recovery</li>
            <li><strong>Historical Records:</strong> Event attendance, volunteer hours, and financial records may be retained longer for chapter record-keeping</li>
            <li><strong>Deleted Accounts:</strong> Upon account deletion, personal data is removed within 30 days (except records required by law)</li>
          </ul>
        </section>

        {/* Your Rights */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p>You have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update or correct inaccurate information via your profile settings</li>
            <li><strong>Deletion:</strong> Request deletion of your account and personal data (subject to record-keeping obligations)</li>
            <li><strong>Opt-Out:</strong> Unsubscribe from notifications via app settings or email links</li>
            <li><strong>Data Portability:</strong> Request an export of your data in machine-readable format</li>
            <li><strong>Object:</strong> Object to processing of your data for specific purposes</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, contact your Chapter Administrator or email us at{' '}
            <a href="mailto:privacy@yiconnect.com" className="text-primary hover:underline">
              privacy@yiconnect.com
            </a>
          </p>
        </section>

        {/* Push Notifications */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Push Notifications</h2>
          <p>
            If you grant permission, Yi Connect sends push notifications to keep you informed about:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Event reminders and updates</li>
            <li>Task assignments and deadlines</li>
            <li>Chapter announcements</li>
            <li>Award nominations and approvals</li>
          </ul>
          <p className="mt-4">
            You can disable push notifications at any time through your device settings or app notification preferences.
          </p>
        </section>

        {/* Offline Data */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Offline Data and Caching</h2>
          <p>
            Yi Connect uses offline caching to provide functionality when you don't have internet access. This means:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Some data is stored locally on your device for offline access</li>
            <li>Actions taken offline (like QR check-in) are queued and synced when you're back online</li>
            <li>Cached data is encrypted and protected by your device security</li>
            <li>You can clear cached data through your device settings</li>
          </ul>
        </section>

        {/* Children's Privacy */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Children's Privacy</h2>
          <p>
            Yi Connect is intended for use by adult members of Yi organizations (ages 18 and above). We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
          </p>
        </section>

        {/* International Users */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">International Users</h2>
          <p>
            Yi Connect is hosted on servers located in the United States. If you access the Service from outside the United States, your information will be transferred to, stored, and processed in the United States. By using the Service, you consent to this transfer.
          </p>
        </section>

        {/* Changes to This Policy */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Posting the new Privacy Policy with an updated "Last Updated" date</li>
            <li>Sending an in-app notification or email</li>
          </ul>
          <p className="mt-4">
            Your continued use of the Service after changes are posted constitutes acceptance of the updated Privacy Policy.
          </p>
        </section>

        {/* Contact Us */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:
          </p>
          <div className="mt-4 p-6 bg-muted rounded-lg">
            <p><strong>Email:</strong> <a href="mailto:privacy@yiconnect.com" className="text-primary hover:underline">privacy@yiconnect.com</a></p>
            <p className="mt-2"><strong>Support:</strong> <a href="mailto:support@yiconnect.com" className="text-primary hover:underline">support@yiconnect.com</a></p>
            <p className="mt-2"><strong>Organization:</strong> JKKN Institutions Yi Chapter Management</p>
          </div>
        </section>

        {/* Data Safety Summary */}
        <section className="mt-12 p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-2xl font-semibold mb-4">Data Safety Summary (for Play Store)</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Data Collected:</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Email address (required)</li>
                <li>Name and profile photo</li>
                <li>Professional skills and interests</li>
                <li>Event participation data</li>
                <li>Device tokens for notifications</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Data Security:</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Encrypted in transit (HTTPS)</li>
                <li>Encrypted at rest (AES-256)</li>
                <li>Row-level security policies</li>
                <li>No data sold to third parties</li>
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <strong>User Rights:</strong> Access, correct, delete, or export your data at any time. Contact privacy@yiconnect.com for assistance.
          </p>
        </section>

      </div>
    </div>
  )
}
