/**
 * Debug endpoint to verify deployment and environment
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    deployed: new Date().toISOString(),
    version: '2025-12-22-debug',
    env: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasWhatsAppUrl: !!process.env.WHATSAPP_SERVICE_URL,
      hasWhatsAppKey: !!process.env.WHATSAPP_API_KEY
    }
  });
}
