/**
 * TWA Setup Helper Script
 *
 * Helps verify prerequisites and configuration for TWA setup.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Yi Connect - TWA Setup Prerequisites Checker\n');

const checks = {
  nodejs: false,
  java: false,
  bubblewrap: false,
  icons: false,
  privacyPolicy: false,
  assetlinks: false,
};

// Check Node.js
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
  checks.nodejs = true;
} catch (error) {
  console.log('❌ Node.js: Not installed');
}

// Check Java (keytool)
try {
  const javaOutput = execSync('java -version 2>&1', { encoding: 'utf-8' });
  const javaVersion = javaOutput.split('\n')[0];
  console.log(`✅ Java: ${javaVersion}`);
  checks.java = true;
} catch (error) {
  console.log('❌ Java: Not installed (required for keytool and Android builds)');
}

// Check Bubblewrap CLI
try {
  const bubblewrapVersion = execSync('bubblewrap --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Bubblewrap CLI: ${bubblewrapVersion}`);
  checks.bubblewrap = true;
} catch (error) {
  console.log('❌ Bubblewrap CLI: Not installed');
  console.log('   Install with: npm install -g @bubblewrap/cli');
}

// Check PNG icons
const iconsDir = path.join(__dirname, '../public/icons');
const requiredIcons = [
  'icon-192x192.png',
  'icon-512x512.png',
  'icon-192x192-maskable.png',
  'icon-512x512-maskable.png',
];

let allIconsExist = true;
requiredIcons.forEach((icon) => {
  const iconPath = path.join(iconsDir, icon);
  if (fs.existsSync(iconPath)) {
    console.log(`✅ Icon: ${icon}`);
  } else {
    console.log(`❌ Icon: ${icon} - Missing`);
    allIconsExist = false;
  }
});
checks.icons = allIconsExist;

// Check privacy policy page
const privacyPolicyPath = path.join(__dirname, '../app/(public)/privacy-policy/page.tsx');
if (fs.existsSync(privacyPolicyPath)) {
  console.log('✅ Privacy policy page: Created');
  checks.privacyPolicy = true;
} else {
  console.log('❌ Privacy policy page: Missing');
}

// Check assetlinks.json
const assetlinksPath = path.join(__dirname, '../public/.well-known/assetlinks.json');
if (fs.existsSync(assetlinksPath)) {
  const assetlinksContent = fs.readFileSync(assetlinksPath, 'utf-8');
  if (assetlinksContent.includes('REPLACE_WITH_YOUR_SHA256_FINGERPRINT')) {
    console.log('⚠️  assetlinks.json: Template exists (needs SHA-256 fingerprint)');
    checks.assetlinks = false;
  } else {
    console.log('✅ assetlinks.json: Configured');
    checks.assetlinks = true;
  }
} else {
  console.log('❌ assetlinks.json: Missing');
}

// Summary
console.log('\n📊 Setup Status:');
console.log('─────────────────────────────────────');

const allChecks = Object.values(checks).every((check) => check);

if (allChecks) {
  console.log('✅ All prerequisites met! Ready for TWA setup.');
} else {
  console.log('⚠️  Some prerequisites missing. See above for details.');

  console.log('\n📋 Next Steps:');
  if (!checks.java) {
    console.log('1. Install Java Development Kit (JDK) 11 or higher');
    console.log('   Download from: https://adoptium.net/');
  }
  if (!checks.bubblewrap) {
    console.log('2. Install Bubblewrap CLI:');
    console.log('   npm install -g @bubblewrap/cli');
  }
  if (!checks.icons) {
    console.log('3. Generate PNG icons:');
    console.log('   node scripts/convert-icons.js');
  }
  if (!checks.assetlinks) {
    console.log('4. Update assetlinks.json with SHA-256 fingerprint after keystore generation');
  }
}

console.log('\n📖 Full guide: docs/TWA_SETUP_GUIDE.md');
