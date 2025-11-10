#!/usr/bin/env node

/**
 * Database Query Tester
 *
 * Tests Supabase connectivity and provides query testing utilities.
 *
 * Usage:
 *   node db-query-tester.js --test-connection
 *   node db-query-tester.js --test-rls table_name
 */

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
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

function showConnectionTest() {
  section('Connection Test');

  log('To test Supabase connection, run this in your browser console:', 'yellow');
  log('', 'reset');
  log('  import { createClientSupabaseClient } from "@/lib/supabase/client";', 'cyan');
  log('  const supabase = createClientSupabaseClient();', 'cyan');
  log('  ', 'reset');
  log('  const { data, error } = await supabase', 'cyan');
  log('    .from("profiles")', 'cyan');
  log('    .select("count")', 'cyan');
  log('    .limit(1);', 'cyan');
  log('  ', 'reset');
  log('  console.log("Connected:", !error);', 'cyan');
  log('  console.log("Error:", error);', 'cyan');
  log('', 'reset');
}

function showRLSTest(tableName) {
  section(`RLS Policy Test for: ${tableName}`);

  log('1. Test in Supabase SQL Editor:', 'yellow');
  log('', 'reset');
  log('  BEGIN;', 'cyan');
  log('  SET LOCAL role = \'authenticated\';', 'cyan');
  log(`  SET LOCAL request.jwt.claim.sub = 'your-user-id';`, 'cyan');
  log('  ', 'reset');
  log(`  SELECT * FROM ${tableName} LIMIT 10;`, 'cyan');
  log('  ', 'reset');
  log('  ROLLBACK;', 'cyan');
  log('', 'reset');

  log('2. Test in browser console:', 'yellow');
  log('', 'reset');
  log('  import { createClientSupabaseClient } from "@/lib/supabase/client";', 'cyan');
  log('  const supabase = createClientSupabaseClient();', 'cyan');
  log('  ', 'reset');
  log('  const { data, error } = await supabase', 'cyan');
  log(`    .from("${tableName}")`, 'cyan');
  log('    .select("*")', 'cyan');
  log('    .limit(10);', 'cyan');
  log('  ', 'reset');
  log('  console.log("Data:", data);', 'cyan');
  log('  console.log("Error:", error);', 'cyan');
  log('', 'reset');

  log('3. Check RLS policies:', 'yellow');
  log('', 'reset');
  log('  SELECT * FROM pg_policies', 'cyan');
  log(`  WHERE tablename = '${tableName}';`, 'cyan');
  log('', 'reset');
}

function showCommonQueries() {
  section('Common Debug Queries');

  const queries = [
    {
      title: 'Check current user',
      code: `const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);`
    },
    {
      title: 'Check user profile',
      code: `const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
console.log('Profile:', profile);`
    },
    {
      title: 'Check institution access',
      code: `const { data: access } = await supabase
  .from('user_institution_access')
  .select('*')
  .eq('user_id', user.id);
console.log('Institution access:', access);`
    },
    {
      title: 'Test basic SELECT',
      code: `const { data, error, status } = await supabase
  .from('your_table')
  .select('*')
  .limit(5);
console.log({ data, error, status });`
    },
    {
      title: 'Test with filters',
      code: `const { data, error } = await supabase
  .from('your_table')
  .select('*')
  .eq('institution_id', 'your-institution-id')
  .limit(10);
console.log({ data, error });`
    }
  ];

  queries.forEach(({ title, code }) => {
    log(`\n${title}:`, 'yellow');
    log(code, 'cyan');
  });
}

function showTroubleshooting() {
  section('Troubleshooting Tips');

  const tips = [
    {
      issue: 'Query returns empty array',
      solutions: [
        'Check if data exists in Supabase dashboard',
        'Verify RLS policies allow user to read',
        'Check institution_id filter matches',
        'Confirm user has required role/permissions'
      ]
    },
    {
      issue: 'Query timeout',
      solutions: [
        'Add indexes on filtered columns',
        'Use pagination (.range())',
        'Select only needed columns',
        'Check for N+1 query patterns'
      ]
    },
    {
      issue: 'Permission denied error',
      solutions: [
        'Check RLS policies in Supabase dashboard',
        'Verify user session is valid',
        'Test with service role (server-side only)',
        'Check custom role permissions'
      ]
    }
  ];

  tips.forEach(({ issue, solutions }) => {
    log(`\n${issue}:`, 'yellow');
    solutions.forEach((solution, i) => {
      log(`  ${i + 1}. ${solution}`, 'green');
    });
  });
}

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    testConnection: false,
    testRLS: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test-connection') {
      options.testConnection = true;
    } else if (args[i] === '--test-rls' && args[i + 1]) {
      options.testRLS = args[i + 1];
      i++;
    }
  }

  return options;
}

// Main
function main() {
  log('\n╔════════════════════════════════════════╗', 'cyan');
  log('║   MyJKKN DB Query Tester v1.0.0        ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  const options = parseArgs();

  if (options.testConnection) {
    showConnectionTest();
  } else if (options.testRLS) {
    showRLSTest(options.testRLS);
  } else {
    // Show all
    showConnectionTest();
    showCommonQueries();
    showTroubleshooting();
  }

  log('\n' + '='.repeat(60), 'cyan');
  log('Copy and paste commands in browser DevTools or SQL Editor', 'green');
  log('='.repeat(60) + '\n', 'cyan');
}

main();
