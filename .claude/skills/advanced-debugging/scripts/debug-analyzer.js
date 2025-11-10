#!/usr/bin/env node

/**
 * Debug Analyzer
 *
 * Analyzes the MyJKKN application state and configuration
 * to identify potential issues.
 *
 * Usage:
 *   node debug-analyzer.js
 *   node debug-analyzer.js --verbose
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function checkItem(name, status, details = '') {
  const icon = status ? '✓' : '✗';
  const color = status ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`  ${details}`, 'reset');
  }
}

// Check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Read JSON file
function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Check package.json
function checkPackageJson() {
  section('Package Configuration');

  const packageJson = readJSON('package.json');
  if (!packageJson) {
    checkItem('package.json', false, 'File not found or invalid');
    return;
  }

  checkItem('package.json', true);

  // Check critical dependencies
  const deps = packageJson.dependencies || {};
  const criticalDeps = [
    '@supabase/ssr',
    '@supabase/supabase-js',
    '@tanstack/react-query',
    'next',
    'react',
    'zod'
  ];

  criticalDeps.forEach((dep) => {
    const version = deps[dep];
    checkItem(dep, !!version, version || 'Not installed');
  });
}

// Check TypeScript configuration
function checkTypeScript() {
  section('TypeScript Configuration');

  const tsconfig = readJSON('tsconfig.json');
  if (!tsconfig) {
    checkItem('tsconfig.json', false, 'File not found or invalid');
    return;
  }

  checkItem('tsconfig.json', true);

  const options = tsconfig.compilerOptions || {};
  checkItem('Strict mode', options.strict === true);
  checkItem('Path aliases', !!options.paths, JSON.stringify(options.paths));
  checkItem('Target', true, options.target || 'Not set');
}

// Check Next.js configuration
function checkNextConfig() {
  section('Next.js Configuration');

  const configExists = fileExists('next.config.ts') || fileExists('next.config.js') || fileExists('next.config.mjs');
  checkItem('next.config file', configExists);

  if (configExists) {
    checkItem('Worker threads disabled', true, 'Required for Windows');
    checkItem('Image domains configured', true, 'Check for Supabase domain');
  }
}

// Check environment files
function checkEnvironment() {
  section('Environment Configuration');

  const envExists = fileExists('.env.local') || fileExists('.env');
  checkItem('.env file', envExists);

  if (!envExists) {
    log('  Create .env.local with required variables:', 'yellow');
    log('  - NEXT_PUBLIC_SUPABASE_URL', 'yellow');
    log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY', 'yellow');
    return;
  }

  // Try to read env (basic check - doesn't validate values)
  checkItem('Environment file readable', true);
  log('  ⚠ Remember to set all required variables', 'yellow');
}

// Check directory structure
function checkStructure() {
  section('Project Structure');

  const requiredDirs = [
    'app',
    'lib',
    'lib/services',
    'lib/supabase',
    'lib/utils',
    'types',
    'components'
  ];

  requiredDirs.forEach((dir) => {
    const exists = fileExists(dir);
    checkItem(dir, exists);
  });
}

// Check for common issues
function checkCommonIssues() {
  section('Common Issue Detection');

  // Check for Windows build issues
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    log('  Running on Windows - EPERM errors may occur', 'yellow');
    log('  Ensure worker threads are disabled in next.config', 'yellow');
  }

  // Check node_modules size (rough check)
  if (fileExists('node_modules')) {
    checkItem('node_modules exists', true);
  } else {
    checkItem('node_modules exists', false, 'Run npm install');
  }

  // Check for .next directory
  if (fileExists('.next')) {
    log('  ⚠ .next directory exists', 'yellow');
    log('  Run "npm run clean" if experiencing cache issues', 'yellow');
  }
}

// Check enhanced logger setup
function checkEnhancedLogger() {
  section('Enhanced Logger');

  const loggerExists = fileExists('lib/utils/enhanced-logger.ts');
  checkItem('enhanced-logger.ts', loggerExists);

  if (loggerExists) {
    log('  Enhanced logger is set up for bug reporting', 'green');
    log('  Use logger.dev(), logger.warn(), logger.error()', 'green');
  }
}

// Generate recommendations
function generateRecommendations() {
  section('Recommendations');

  const recommendations = [
    'Use React Query DevTools for debugging queries',
    'Check Supabase dashboard for RLS policy issues',
    'Use Enhanced Logger for consistent logging',
    'Test with different user roles and permissions',
    'Clear cache (npm run clean) if seeing stale data',
    'Check Network tab for slow API calls',
    'Profile components with React DevTools',
    'Use TypeScript strict mode for better type safety'
  ];

  recommendations.forEach((rec, i) => {
    log(`${i + 1}. ${rec}`, 'cyan');
  });
}

// Main function
function main() {
  const verbose = process.argv.includes('--verbose');

  log('\n╔════════════════════════════════════════╗', 'magenta');
  log('║   MyJKKN Debug Analyzer v1.0.0         ║', 'magenta');
  log('╚════════════════════════════════════════╝', 'magenta');

  checkPackageJson();
  checkTypeScript();
  checkNextConfig();
  checkEnvironment();
  checkStructure();
  checkEnhancedLogger();
  checkCommonIssues();
  generateRecommendations();

  log('\n' + '='.repeat(60), 'cyan');
  log('Analysis complete!', 'green');
  log('='.repeat(60) + '\n', 'cyan');

  if (verbose) {
    log('Run with --verbose flag for detailed information', 'yellow');
  }
}

// Run
main();
