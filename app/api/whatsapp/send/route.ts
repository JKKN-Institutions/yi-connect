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
 */
function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
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
    } else if (isServerless()) {
      // Serverless without API configured
      return NextResponse.json({
        success: false,
        error: 'WhatsApp service not configured'
      });
    } else {
      // Development: Use local client
      const { sendTextMessage } = await import('@/lib/whatsapp');
      const result = await sendTextMessage(phoneNumber, message);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('[API] WhatsApp send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
