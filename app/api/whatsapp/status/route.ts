/**
 * WhatsApp Connection Status API
 * GET: Returns current connection status and QR code if available
 */

import { NextResponse } from 'next/server';
import { getConnectionStatus, initializeWhatsApp, isReady } from '@/lib/whatsapp';

export async function GET() {
  try {
    const status = getConnectionStatus();

    return NextResponse.json({
      success: true,
      ...status
    });
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
    // Initialize/connect WhatsApp
    const result = await initializeWhatsApp();

    return NextResponse.json({
      success: result.success,
      status: result.status,
      error: result.error
    });
  } catch (error) {
    console.error('[API] WhatsApp initialize error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
}
