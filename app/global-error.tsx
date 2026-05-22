'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang='en'>
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f9fafb'
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '4rem',
                height: '4rem',
                margin: '0 auto 1rem',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                width='32'
                height='32'
                viewBox='0 0 24 24'
                fill='none'
                stroke='#ef4444'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' />
                <path d='M12 9v4' />
                <path d='M12 17h.01' />
              </svg>
            </div>
            <h1
              style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '0.5rem'
              }}
            >
              Application Error
            </h1>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '1.5rem'
              }}
            >
              A critical error occurred. Please try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <div
                style={{
                  backgroundColor: '#f3f4f6',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  marginBottom: '1.5rem',
                  textAlign: 'left'
                }}
              >
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: '#6b7280',
                    wordBreak: 'break-all'
                  }}
                >
                  {error.message}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={() => reset()}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Try Again
              </button>
              <a
                href='/'
                style={{
                  backgroundColor: 'white',
                  color: '#374151',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
