/**
 * Sentry instrumentation entry point for server and edge runtimes.
 *
 * Next.js 16 calls this file's exported `register()` once at startup.
 * Client-side init lives in `instrumentation-client.ts`.
 *
 * Errors are tagged with:
 *   - app: 'yi-connect'
 *   - module: <yi-connect | yip | yi-future>  (derived from request URL)
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

  // Skip init if DSN not configured (avoids noisy 'No DSN' warnings in dev).
  if (!dsn) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // Default tag applied to every event from this runtime.
      initialScope: {
        tags: {
          app: 'yi-connect',
          module: 'yi-connect',
          runtime: 'nodejs',
        },
      },
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      initialScope: {
        tags: {
          app: 'yi-connect',
          module: 'yi-connect',
          runtime: 'edge',
        },
      },
    });
  }
}

// Captures errors thrown during request handling (Next 15+ hook).
export const onRequestError = Sentry.captureRequestError;
