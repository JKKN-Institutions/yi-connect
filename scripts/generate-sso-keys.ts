/**
 * Generate RSA Key Pair for Yi Creative SSO
 *
 * Run with: npx tsx scripts/generate-sso-keys.ts
 *
 * This generates:
 * - Private key (keep in Yi Connect .env.local)
 * - Public key (share with Yi Creative)
 */

import * as jose from 'jose'

async function generateKeys() {
  console.log('Generating RSA key pair for Yi Creative SSO...\n')

  // Generate RSA key pair (RS256)
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })

  // Export keys in PEM format
  const privateKeyPem = await jose.exportPKCS8(privateKey)
  const publicKeyPem = await jose.exportSPKI(publicKey)

  // Convert to base64 for .env storage (single line)
  const privateKeyBase64 = Buffer.from(privateKeyPem).toString('base64')
  const publicKeyBase64 = Buffer.from(publicKeyPem).toString('base64')

  console.log('=' .repeat(80))
  console.log('ADD TO YI CONNECT .env.local:')
  console.log('=' .repeat(80))
  console.log(`YI_CREATIVE_SSO_PRIVATE_KEY="${privateKeyBase64}"`)
  console.log('')

  console.log('=' .repeat(80))
  console.log('SHARE WITH YI CREATIVE (Public Key):')
  console.log('=' .repeat(80))
  console.log(`YI_CONNECT_SSO_PUBLIC_KEY="${publicKeyBase64}"`)
  console.log('')

  console.log('=' .repeat(80))
  console.log('WEBHOOK SECRET (generate random):')
  console.log('=' .repeat(80))
  const webhookSecret = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')
  console.log(`YI_CREATIVE_WEBHOOK_SECRET="${webhookSecret}"`)
  console.log('')

  console.log('=' .repeat(80))
  console.log('PUBLIC KEY (PEM format for Yi Creative reference):')
  console.log('=' .repeat(80))
  console.log(publicKeyPem)
}

generateKeys().catch(console.error)
