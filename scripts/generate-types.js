/**
 * Generate TypeScript types from Supabase database
 * Run with: node scripts/generate-types.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'oihqhqrxsbkdohxfbgpg';
const OUTPUT_FILE = path.join(__dirname, '..', 'types', 'supabase.ts');

console.log('Generating TypeScript types from Supabase...');

try {
  const types = execSync(
    `npx supabase gen types typescript --project-id ${PROJECT_ID}`,
    {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    }
  );

  fs.writeFileSync(OUTPUT_FILE, types);
  console.log(`✓ Types generated successfully at ${OUTPUT_FILE}`);
  console.log(`  File size: ${(types.length / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error('Failed to generate types:', error.message);
  process.exit(1);
}
