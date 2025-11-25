# JKKN Bug Reporter SDK - Integration Guide

Complete guide to integrate JKKN Bug Reporter into your Next.js applications with Supabase.

---

# Installation

Install the Bug Reporter SDK package in your Next.js project.

## Step 1: Install the SDK Package

### Option A: Install from npm (Recommended)

```bash
npm install @boobalan_jkkn/bug-reporter-sdk
```

Or using yarn:

```bash
yarn add @boobalan_jkkn/bug-reporter-sdk
```

### Option B: Install from file path (for development)

```bash
npm install file:../packages/bug-reporter-sdk
```

### Option C: Install from built package

```bash
# First, build the SDK package
cd packages/bug-reporter-sdk
npm run build

# Then install in your project
cd your-project-directory
npm install file:path/to/packages/bug-reporter-sdk
```

## Published on npm Registry

The SDK is now available on npm as `@boobalan_jkkn/bug-reporter-sdk@1.1.0`. Simply install it using npm or yarn - no additional setup required!

### Package Details:
- **Version:** 1.1.0 (Latest)
- **Size:** 18.6 KB (86.4 KB unpacked)
- **Includes:** CJS, ESM, TypeScript definitions
- **Dependencies:** 3 (including @boobalan_jkkn/shared)
- **NEW:** Mandatory screenshots + Auto console logs

### Links:
- [View SDK on npm](https://www.npmjs.com/package/@boobalan_jkkn/bug-reporter-sdk)
- [View Shared Types](https://www.npmjs.com/package/@boobalan_jkkn/shared)

## Troubleshooting: Getting 404 Error?

If you see "npm error 404 Not Found" when installing, clear your npm cache first:

```bash
npm cache clean --force
npm install @boobalan_jkkn/bug-reporter-sdk
```

This happens when npm's local cache hasn't updated with newly published packages.

## Requirements

- Next.js 15+ with App Router
- React 19+
- TypeScript 5+ (recommended)
- Node.js 18+


---

# Configuration

Generate API credentials from the JKKN Bug Reporter platform.

## Step 2: Get Your API Key

### 1. Sign up / Log in

Go to the [platform login page](/login) and authenticate.

### 2. Create Organization

Create a new organization (usually your department name) or join an existing one.

### 3. Register Application

Navigate to **Applications → New Application** and register your app:

| Field | Description |
|-------|-------------|
| Name | Your application name |
| Slug | unique-app-slug |
| Description | Brief description of your app |

### 4. Copy API Key

After creating the application, you'll receive an API key. Copy and save it securely.

```
app_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Security Warning

> **IMPORTANT:** Never commit API keys to version control. Use environment variables to store sensitive credentials.


---

# Next.js Integration

Complete setup for Next.js 15 with App Router.

## Step 3: Next.js Integration

### 3.1. Environment Variables

Create a `.env.local` file in your project root:

```bash
# JKKN Bug Reporter Configuration
NEXT_PUBLIC_BUG_REPORTER_API_KEY=app_your_api_key_here
NEXT_PUBLIC_BUG_REPORTER_API_URL=https://your-platform.vercel.app
```

### 3.2. Root Layout Setup

Update your `app/layout.tsx`:

```tsx
import { BugReporterProvider } from '@boobalan_jkkn/bug-reporter-sdk';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <BugReporterProvider
          apiKey={process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY!}
          apiUrl={process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL!}
          enabled={true}
          debug={process.env.NODE_ENV === 'development'}
          userContext={{
            userId: 'user-id-here', // Optional
            name: 'John Doe',       // Optional
            email: 'user@jkkn.ac.in' // Optional
          }}
        >
          {children}
        </BugReporterProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
```

### 3.3. With Supabase Authentication

For authenticated apps using Supabase:

```tsx
'use client';

import { BugReporterProvider } from '@boobalan_jkkn/bug-reporter-sdk';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function BugReporterWrapper({
  children
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  return (
    <BugReporterProvider
      apiKey={process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY!}
      apiUrl={process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL!}
      enabled={true}
      userContext={user ? {
        userId: user.id,
        name: user.user_metadata?.full_name,
        email: user.email
      } : undefined}
    >
      {children}
    </BugReporterProvider>
  );
}
```

## What You Get

- Floating bug report button (bottom-right)
- **MANDATORY** screenshot capture (v1.1.0+)
- **AUTOMATIC** console logs capture (v1.1.0+)
- User context tracking
- Browser and system info


---

# Advanced Configuration

Customize behavior and add advanced features.

## Custom Widget Styling

Override default styles using CSS classes:

```css
/* globals.css */
.bug-reporter-widget {
  /* Custom floating button styles */
  bottom: 2rem !important;
  right: 2rem !important;
}

.bug-reporter-sdk {
  /* Custom modal/widget styles */
  font-family: 'Your Custom Font' !important;
}
```

## Conditional Rendering

Show/hide bug reporter based on conditions:

```tsx
<BugReporterProvider
  apiKey={process.env.NEXT_PUBLIC_BUG_REPORTER_API_KEY!}
  apiUrl={process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL!}
  enabled={
    process.env.NODE_ENV === 'production' &&
    user?.role === 'beta-tester'
  }
  debug={false}
>
  {children}
</BugReporterProvider>
```

## Add "My Bugs" Panel

Let users view their submitted bugs:

```tsx
import { MyBugsPanel } from '@boobalan_jkkn/bug-reporter-sdk';

export default function ProfilePage() {
  return (
    <div>
      <h1>My Profile</h1>
      <MyBugsPanel />
    </div>
  );
}
```

## Programmatic Bug Reporting

Trigger bug reports from code:

```tsx
import { useBugReporter } from '@boobalan_jkkn/bug-reporter-sdk';

function MyComponent() {
  const { apiClient } = useBugReporter();

  const handleError = async (error: Error) => {
    try {
      await apiClient?.createBugReport({
        title: 'Automatic Error Report',
        description: error.message,
        page_url: window.location.href,
        category: 'error',
        console_logs: [],
      });
    } catch (err) {
      console.error('Failed to report bug:', err);
    }
  };

  return <button onClick={() => handleError(new Error('Test'))}>
    Report Error
  </button>;
}
```

---

# Troubleshooting

Common issues and solutions.

## npm install shows 404 error?

- Clear npm cache: `npm cache clean --force`
- Wait 5-10 minutes if package was just published
- Try with explicit registry: `npm install @boobalan_jkkn/bug-reporter-sdk --registry=https://registry.npmjs.org/`
- Verify package exists at: [npmjs.com](https://www.npmjs.com/package/@boobalan_jkkn/bug-reporter-sdk)

## Widget not appearing?

- Check that `enabled={true}` is set
- Verify API key is correct
- Check browser console for errors
- Ensure API URL is reachable

## API key validation failed?

- Verify API key starts with "app_"
- Check that application is active
- Ensure API URL matches platform URL
- Try regenerating the API key

## Screenshots not capturing? (v1.1.0+)

- Screenshot is now MANDATORY - widget won't open without it
- Browser may block html2canvas library
- Check Content Security Policy (CSP)
- Verify no conflicting screenshot libraries
- Try closing overlays/modals and retry

## Console logs empty? (v1.1.0+)

- Logs capture automatically in v1.1.0+
- Perform actions that generate console output before reporting
- Verify you're using v1.1.0 or later: `npm list @boobalan_jkkn/bug-reporter-sdk`
- Check BugReporterProvider wraps your app correctly

## How to update to v1.1.0?

If you already have the SDK installed, update to the latest version:

```bash
npm install @boobalan_jkkn/bug-reporter-sdk@latest
```

- No breaking changes - fully backward compatible!
- New features work automatically
- No configuration changes needed


---

## API Reference

### BugReporterProvider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| apiKey | string | Yes | Your application API key |
| apiUrl | string | Yes | Bug Reporter platform URL |
| enabled | boolean | No | Enable/disable the widget (default: true) |
| debug | boolean | No | Enable debug mode (default: false) |
| userContext | object | No | User information for tracking |

### userContext Object

| Field | Type | Description |
|-------|------|-------------|
| userId | string | Unique user identifier |
| name | string | User's display name |
| email | string | User's email address |

### Exported Components

- `BugReporterProvider` - Main provider component
- `MyBugsPanel` - Panel to view submitted bugs
- `useBugReporter` - Hook for programmatic access

---

## Support

Need help? Our team is here to support JKKN developers.

- [Go to Dashboard](/login)
- Contact Support

---

*© 2025 JKKN Bug Reporter. All rights reserved.*
