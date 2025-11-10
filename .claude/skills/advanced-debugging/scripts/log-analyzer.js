#!/usr/bin/env node

/**
 * Log Analyzer
 *
 * Analyzes console logs and identifies patterns, errors, and issues.
 *
 * Usage:
 *   node log-analyzer.js
 *   node log-analyzer.js --filter error
 *   node log-analyzer.js --module billing
 */

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

function analyzeLogs() {
  section('Log Analysis');

  log('This tool analyzes enhanced logger output.', 'yellow');
  log('\nTo use:', 'cyan');
  log('1. Open browser DevTools', 'green');
  log('2. Run the following in console:', 'green');
  log('', 'reset');
  log('   import { getLogManager } from "@/lib/utils/enhanced-logger";', 'yellow');
  log('   const manager = getLogManager();', 'yellow');
  log('   console.log(manager.getSummary());', 'yellow');
  log('   console.log(manager.getLogsByModule());', 'yellow');
  log('', 'reset');
  log('3. Review the output for:', 'green');
  log('   - Modules with high error counts', 'yellow');
  log('   - Repeated error messages', 'yellow');
  log('   - Critical errors list', 'yellow');
  log('', 'reset');

  section('Common Log Patterns');

  const patterns = [
    {
      pattern: '[module] Error:',
      meaning: 'Service layer error',
      action: 'Check service implementation and error handling'
    },
    {
      pattern: 'RLS policy',
      meaning: 'Row-level security blocking access',
      action: 'Check Supabase RLS policies for the table'
    },
    {
      pattern: 'Query timeout',
      meaning: 'Database query taking too long',
      action: 'Add indexes, use pagination, or optimize query'
    },
    {
      pattern: 'Cannot read property',
      meaning: 'Null/undefined access',
      action: 'Add null checks before accessing properties'
    },
    {
      pattern: 'Failed to fetch',
      meaning: 'Network request failed',
      action: 'Check API endpoint and network connectivity'
    }
  ];

  patterns.forEach(({ pattern, meaning, action }) => {
    log(`\nPattern: "${pattern}"`, 'yellow');
    log(`Meaning: ${meaning}`, 'cyan');
    log(`Action: ${action}`, 'green');
  });

  section('Debugging Workflow');

  const steps = [
    'Find module with highest error count',
    'Look at top repeated errors in that module',
    'Check the error message and stack trace',
    'Follow debugging-workflows.md for that error type',
    'Fix the issue and verify logs decrease'
  ];

  steps.forEach((step, i) => {
    log(`${i + 1}. ${step}`, 'green');
  });
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    filter: null,
    module: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--filter' && args[i + 1]) {
      options.filter = args[i + 1];
      i++;
    } else if (args[i] === '--module' && args[i + 1]) {
      options.module = args[i + 1];
      i++;
    }
  }

  return options;
}

// Main
function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   MyJKKN Log Analyzer v1.0.0           ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  const options = parseArgs();

  if (options.filter) {
    log(`\nFiltering by type: ${options.filter}`, 'yellow');
  }
  if (options.module) {
    log(`Filtering by module: ${options.module}`, 'yellow');
  }

  analyzeLogs();

  log('\n' + '='.repeat(60), 'cyan');
  log('For detailed logs, use browser DevTools', 'green');
  log('='.repeat(60) + '\n', 'cyan');
}

main();
