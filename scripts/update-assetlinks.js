/**
 * Update assetlinks.json with SHA-256 Fingerprint
 *
 * Usage: node scripts/update-assetlinks.js <sha256-fingerprint>
 * Example: node scripts/update-assetlinks.js "14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C"
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: SHA-256 fingerprint required');
  console.log('\nUsage:');
  console.log('  node scripts/update-assetlinks.js "<your-sha256-fingerprint>"');
  console.log('\nExample:');
  console.log('  node scripts/update-assetlinks.js "14:F9:D8:A5:E8:9E:5A:1C:3C:58:B2:9A:5C:8B:1D:5E:3F:2A:1B:4C:9D:8E:7F:6A:5B:4C:3D:2E:1F:0A:9B:8C"');
  console.log('\nTo get your SHA-256 fingerprint:');
  console.log('  keytool -list -v -keystore yi-connect-release.keystore -alias yi-connect-key');
  process.exit(1);
}

const sha256Fingerprint = args[0];

// Validate fingerprint format (should have colons)
if (!sha256Fingerprint.includes(':')) {
  console.error('❌ Error: Invalid SHA-256 format. Expected format with colons: 14:F9:D8:...');
  process.exit(1);
}

const assetlinksPath = path.join(__dirname, '../public/.well-known/assetlinks.json');

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'com.jkkninstitutions.yiconnect',
      sha256_cert_fingerprints: [sha256Fingerprint],
    },
  },
];

try {
  fs.writeFileSync(assetlinksPath, JSON.stringify(assetlinks, null, 2));
  console.log('✅ assetlinks.json updated successfully!');
  console.log(`📄 File: ${assetlinksPath}`);
  console.log(`🔑 SHA-256: ${sha256Fingerprint}`);
  console.log('\n📋 Next steps:');
  console.log('1. Commit and push to deploy assetlinks.json to Vercel');
  console.log('2. Verify accessibility: https://yi-connect.vercel.app/.well-known/assetlinks.json');
  console.log('3. Continue with TWA build in Bubblewrap');
} catch (error) {
  console.error('❌ Error writing assetlinks.json:', error.message);
  process.exit(1);
}
