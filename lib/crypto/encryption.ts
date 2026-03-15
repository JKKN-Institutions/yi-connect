/**
 * Application-level encryption for sensitive data stored in the database.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * Encrypted values are stored as: iv:authTag:ciphertext (all base64)
 */

import * as crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get the encryption key from environment.
 * Must be a 32-byte (256-bit) key, provided as a 64-char hex string.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.DB_ENCRYPTION_KEY
  if (!keyHex) {
    // In development, use a deterministic key derived from a passphrase
    // In production, DB_ENCRYPTION_KEY MUST be set
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DB_ENCRYPTION_KEY environment variable is required in production')
    }
    // Development fallback: derive key from a fixed passphrase
    return crypto.scryptSync('yi-connect-dev-encryption-key', 'yi-connect-salt', 32)
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns the encrypted value as a string in format: iv:authTag:ciphertext (all base64)
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypt an encrypted string.
 * Expects input in format: iv:authTag:ciphertext (all base64)
 * Returns null if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptSecret(encrypted: string): string | null {
  try {
    const parts = encrypted.split(':')
    if (parts.length !== 3) {
      // Not encrypted (legacy plaintext value) - return as-is
      return encrypted
    }

    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const ciphertext = parts[2]

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch {
    // If decryption fails, the value might be legacy plaintext
    return encrypted
  }
}

/**
 * Check if a value appears to be encrypted (has the iv:tag:cipher format).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')
  if (parts.length !== 3) return false
  // Check that all parts are valid base64
  try {
    Buffer.from(parts[0], 'base64')
    Buffer.from(parts[1], 'base64')
    return true
  } catch {
    return false
  }
}

/**
 * Encrypt a value only if it's not already encrypted.
 */
export function ensureEncrypted(value: string): string {
  if (isEncrypted(value)) return value
  return encryptSecret(value)
}
