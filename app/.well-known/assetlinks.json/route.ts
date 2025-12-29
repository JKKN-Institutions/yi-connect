/**
 * Digital Asset Links API Route
 *
 * Serves assetlinks.json for TWA (Trusted Web Activity) verification.
 * This route ensures the file is accessible at /.well-known/assetlinks.json
 * regardless of static file configuration issues.
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    // Read the assetlinks.json file from public directory
    const filePath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json')
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const assetlinks = JSON.parse(fileContents)

    return NextResponse.json(assetlinks, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error reading assetlinks.json:', error)

    // Fallback: return template if file doesn't exist
    return NextResponse.json(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.jkkninstitutions.yiconnect',
            sha256_cert_fingerprints: [
              'REPLACE_WITH_YOUR_SHA256_FINGERPRINT_FROM_KEYSTORE',
            ],
          },
        },
      ],
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}

// Enable Edge Runtime for faster responses
export const runtime = 'edge'
