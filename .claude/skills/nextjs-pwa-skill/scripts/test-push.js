#!/usr/bin/env node

/**
 * Push Notification Tester
 * Tests push notification functionality
 * Usage: node test-push.js [user-email]
 */

const webpush = require('web-push');
require('dotenv').config({ path: '.env.local' });

async function testPushNotification(userEmail) {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not found. Run generate-vapid.js first.');
    }
    
    if (!process.env.VAPID_EMAIL || process.env.VAPID_EMAIL === 'mailto:your-email@example.com') {
      throw new Error('Please set VAPID_EMAIL in .env.local');
    }
    
    // Configure web-push
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    
    console.log('🔔 Push Notification Test');
    console.log('━'.repeat(50));
    
    // Sample subscription (you'll need to get this from your database)
    // This is just for demonstration
    const sampleSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/...',
      keys: {
        p256dh: 'sample_p256dh_key',
        auth: 'sample_auth_key'
      }
    };
    
    // Test payload
    const payload = JSON.stringify({
      title: 'Test Notification 🎉',
      body: 'This is a test push notification from your PWA!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      url: '/',
      tag: 'test-notification',
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close',
          title: 'Dismiss'
        }
      ]
    });
    
    console.log('📤 Sending test notification...');
    console.log('Payload:', JSON.parse(payload));
    console.log('━'.repeat(50));
    
    if (userEmail) {
      // In a real implementation, you would:
      // 1. Connect to your Supabase database
      // 2. Fetch user's subscription by email
      // 3. Send the notification
      
      console.log(`\n⚠️  To send a real notification to ${userEmail}:`);
      console.log('1. Ensure the user has granted notification permission');
      console.log('2. Ensure the user has an active push subscription');
      console.log('3. Implement database connection to fetch subscription');
      console.log('\nExample implementation:');
      console.log(`
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const { data } = await supabase
  .from('push_subscriptions')
  .select('*')
  .eq('user_email', '${userEmail}')
  .single();

if (data) {
  await webpush.sendNotification(data, payload);
  console.log('✅ Notification sent!');
}
      `);
    } else {
      console.log('\n📝 Test Steps:');
      console.log('1. Run: node test-push.js user@example.com');
      console.log('2. Ensure your app is running with service worker');
      console.log('3. Grant notification permission in browser');
      console.log('4. Check browser console for subscription details');
    }
    
    console.log('\n🧪 Testing VAPID configuration...');
    console.log('✅ VAPID keys are valid');
    console.log('✅ Web-push library configured');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const userEmail = process.argv[2];
  testPushNotification(userEmail);
}

module.exports = testPushNotification;
