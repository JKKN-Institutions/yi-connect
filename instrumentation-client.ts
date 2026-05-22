/**
 * Sentry instrumentation entry point for the browser runtime.
 *
 * Next.js 16 picks this file up automatically for client-side init.
 *
 * Errors are tagged with:
 *   - app: 'yi-connect'
 *   - module: <yi-connect | yip | yi-future>  (derived from window.location.pathname)
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

// Derive module tag from the current path so errors from /yip and /yi-future
// nested mounts can be filtered separately in Sentry.
function getModuleTag(): 'yi-connect' | 'yip' | 'yi-future' {
  if (typeof window === 'undefined') return 'yi-connect';
  const path = window.location.pathname;
  if (path.startsWith('/yip')) return 'yip';
  if (path.startsWith('/yi-future')) return 'yi-future';
  return 'yi-connect';
}

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    initialScope: {
      tags: {
        app: 'yi-connect',
        module: getModuleTag(),
        runtime: 'browser',
      },
    },
  });
}

// Required by Sentry for client-side navigation transaction tracking in App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
