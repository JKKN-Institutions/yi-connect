/**
 * WhatsApp Connection Status API
 * GET: Returns current connection status and QR code if available
 * POST: Initialize/connect WhatsApp
 *
 * Uses API client (Railway service) in production, local client in dev
 */

import { NextResponse } from 'next/server';
import {
  isServiceConfigured,
  getWhatsAppStatusAPI,
  connectWhatsAppAPI
} from '@/lib/whatsapp/api-client';
import { getWhatsAppAccess } from '@/lib/whatsapp/access';

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

/**
 * Check if we should use the API client (production) or local client (dev)
 */
function shouldUseApiClient(): boolean {
  return isServiceConfigured();
}

/**
 * Dynamic import helper for local client (only loads when needed in dev)
 */
async function getLocalClient() {
  const { getConnectionStatus, initializeWhatsApp } = await import('@/lib/whatsapp');
  return { getConnectionStatus, initializeWhatsApp };
}

export async function GET() {
  try {
    // Require a leadership role — the status carries the QR code that links a
    // phone to the chapter account, and POST starts the client.
    const access = await getWhatsAppAccess();
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    if (shouldUseApiClient()) {
      // Production: Use Railway service
      const status = await getWhatsAppStatusAPI();
      return NextResponse.json({
        success: true,
        ...status
      });
    } else if (isServerless()) {
      // Serverless without API configured - can't run local client
      return NextResponse.json({
        success: false,
        status: 'not_configured',
        qrCode: null,
        error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.',
        isReady: false,
        setupRequired: true
      });
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Use local client
      const { getConnectionStatus } = await getLocalClient();
      const status = getConnectionStatus();
      return NextResponse.json({
        success: true,
        ...status
      });
    } else {
      // Production without Railway service - return setup required
      return NextResponse.json({
        success: false,
        status: 'not_configured',
        qrCode: null,
        error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.',
        isReady: false,
        setupRequired: true
      });
    }
  } catch (error) {
    console.error('[API] WhatsApp status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Require a leadership role — the status carries the QR code that links a
    // phone to the chapter account, and POST starts the client.
    const access = await getWhatsAppAccess();
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    if (shouldUseApiClient()) {
      // Production: Use Railway service
      const result = await connectWhatsAppAPI();
      return NextResponse.json({
        success: result.success,
        status: result.status,
        qrCode: result.qrCode,
        error: result.error
      });
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Use local client
      const { initializeWhatsApp } = await getLocalClient();
      const result = await initializeWhatsApp();
      return NextResponse.json({
        success: result.success,
        status: result.status,
        error: result.error
      });
    } else {
      // Production without Railway service - return setup required
      return NextResponse.json({
        success: false,
        status: 'not_configured',
        qrCode: null,
        error: 'WhatsApp service not configured. Please set up the Railway WhatsApp service.',
        setupRequired: true
      });
    }
  } catch (error) {
    console.error('[API] WhatsApp initialize error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
}
