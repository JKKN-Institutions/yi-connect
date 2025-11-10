#!/usr/bin/env node

/**
 * VAPID Key Generator for Web Push Notifications
 * Generates VAPID public and private keys for push notifications
 * Usage: node generate-vapid.js
 */

const webpush = require('web-push');
const fs = require('fs').promises;
const path = require('path');

async function generateVapidKeys() {
  try {
    console.log('🔐 Generating VAPID keys for push notifications...\n');
    
    const vapidKeys = webpush.generateVAPIDKeys();
    
    // Create .env.local content
    const envContent = `# Web Push VAPID Keys
# Generated on ${new Date().toISOString()}

# Public key (safe to expose in client-side code)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}

# Private key (keep secret, server-side only)
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}

# Contact email for VAPID
VAPID_EMAIL=mailto:your-email@example.com
`;

    // Check if .env.local exists
    const envPath = '.env.local';
    let existingContent = '';
    
    try {
      existingContent = await fs.readFile(envPath, 'utf8');
      
      // Check if VAPID keys already exist
      if (existingContent.includes('VAPID_PUBLIC_KEY') || existingContent.includes('VAPID_PRIVATE_KEY')) {
        console.log('⚠️  VAPID keys already exist in .env.local');
        console.log('To regenerate, remove existing VAPID_* variables first.\n');
        
        console.log('New keys (not saved):');
        console.log('━'.repeat(50));
        console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
        console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
        console.log('━'.repeat(50));
        return;
      }
      
      // Append to existing file
      await fs.writeFile(envPath, existingContent + '\n' + envContent);
      console.log('✅ VAPID keys appended to .env.local');
      
    } catch (error) {
      // File doesn't exist, create it
      await fs.writeFile(envPath, envContent);
      console.log('✅ Created .env.local with VAPID keys');
    }
    
    // Display keys in console
    console.log('\n📋 Your VAPID Keys:');
    console.log('━'.repeat(50));
    console.log('Public Key (client-side):');
    console.log(vapidKeys.publicKey);
    console.log('\nPrivate Key (server-side, keep secret):');
    console.log(vapidKeys.privateKey);
    console.log('━'.repeat(50));
    
    console.log('\n⚠️  Important:');
    console.log('1. Update VAPID_EMAIL with your actual email address');
    console.log('2. Never commit VAPID_PRIVATE_KEY to version control');
    console.log('3. Add .env.local to .gitignore if not already added');
    console.log('4. Restart your Next.js development server');
    
  } catch (error) {
    console.error('❌ Error generating VAPID keys:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateVapidKeys();
}

module.exports = generateVapidKeys;
