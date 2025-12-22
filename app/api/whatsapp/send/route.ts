/**
 * WhatsApp Send Message API
 * POST: Send a message to a phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isServiceConfigured,
  sendMessageAPI
} from '@/lib/whatsapp/api-client';

/**
 * Check if we're running on Vercel (serverless environment)
 * Uses multiple detection methods for reliability
 */
function isServerless(): boolean {
  // Check Vercel environment variables
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    return true;
  }
  // Check AWS Lambda
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return true;
  }
  // If not explicitly in development and no local client configured, assume serverless
  if (process.env.NODE_ENV === 'production' && !isServiceConfigured()) {
    return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, message } = body;

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { success: false, error: 'phoneNumber and message are required' },
        { status: 400 }
      );
    }

    if (isServiceConfigured()) {
      // Production: Use Railway service
      const result = await sendMessageAPI(phoneNumber, message);
      return NextResponse.json(result);
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Use local client
      const { sendTextMessage } = await import('@/lib/whatsapp');
      const result = await sendTextMessage(phoneNumber, message);
      return NextResponse.json(result);
    } else {
      // Production without Railway service
      return NextResponse.json({
        success: false,
        error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.'
      });
    }
  } catch (error) {
    console.error('[API] WhatsApp send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
