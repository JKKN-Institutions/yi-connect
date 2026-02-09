/**
 * Extract Public Key from Private Key
 *
 * Run with: npx tsx scripts/extract-public-key.ts
 *
 * This extracts the public key from the private key stored in .env.local
 * to ensure Yi Creative has the matching public key for token verification.
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

async function extractPublicKey() {
  // Read .env.local to get the private key
  const envPath = path.join(process.cwd(), '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf-8')

  // Extract the private key value
  const match = envContent.match(/YI_CREATIVE_SSO_PRIVATE_KEY="([^"]+)"/)
  if (!match) {
    console.error('YI_CREATIVE_SSO_PRIVATE_KEY not found in .env.local')
    process.exit(1)
  }

  const privateKeyBase64 = match[1]

  // Decode base64 to PEM
  const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf-8')

  console.log('Private key loaded from .env.local')
  console.log('')

  // Extract public key using Node.js crypto
  const privateKeyObject = crypto.createPrivateKey(privateKeyPem)
  const publicKeyObject = crypto.createPublicKey(privateKeyObject)
  const publicKeyPem = publicKeyObject.export({ type: 'spki', format: 'pem' }) as string

  // Base64 encode for env var (remove header/footer and newlines)
  const publicKeyBase64 = Buffer.from(publicKeyPem).toString('base64')

  // Extract just the key content (without headers) for compact format
  const publicKeyContent = publicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\n/g, '')
    .trim()

  console.log('='.repeat(80))
  console.log('CORRECT PUBLIC KEY (PEM format):')
  console.log('='.repeat(80))
  console.log(publicKeyPem)

  console.log('='.repeat(80))
  console.log('FOR YI CREATIVE .env.local (base64 encoded full PEM):')
  console.log('='.repeat(80))
  console.log(`YI_CONNECT_SSO_PUBLIC_KEY="${publicKeyBase64}"`)
  console.log('')

  console.log('='.repeat(80))
  console.log('FOR YI CREATIVE .env.local (compact - just key content):')
  console.log('='.repeat(80))
  console.log(`YI_CONNECT_SSO_PUBLIC_KEY="${publicKeyContent}"`)
  console.log('')

  console.log('='.repeat(80))
  console.log('VERIFICATION:')
  console.log('='.repeat(80))
  console.log('1. Copy one of the above to Yi Creative .env.local')
  console.log('2. Restart Yi Creative dev server')
  console.log('3. Try "Create Poster" button again')
}

extractPublicKey().catch(console.error)
