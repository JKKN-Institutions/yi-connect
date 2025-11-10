#!/usr/bin/env python3
"""
Validate SQL File Management

Checks for duplicate SQL files and ensures all SQL is in correct locations.
This prevents the common mistake of creating multiple SQL files instead of
updating existing ones in supabase/setup/.

Usage:
    python validate_sql_files.py [path/to/supabase]

Returns:
    0 - All checks passed
    1 - Validation errors found
"""

import sys
import os
from pathlib import Path
from collections import defaultdict

# Correct file locations
CORRECT_FILES = {
    'tables': 'supabase/setup/01_tables.sql',
    'functions': 'supabase/setup/02_functions.sql',
    'policies': 'supabase/setup/03_policies.sql',
    'triggers': 'supabase/setup/04_triggers.sql',
    'views': 'supabase/setup/05_views.sql',
}

# Patterns that indicate incorrect SQL files
INCORRECT_PATTERNS = [
    '_schema.sql',
    '_module.sql',
    '_setup.sql',
    '_tables.sql',
    '_functions.sql',
    '_policies.sql',
    '_complete.sql',
    'new_',
    'temp_',
]


def find_sql_files(base_path):
    """Find all .sql files in the supabase directory."""
    sql_files = []
    supabase_path = Path(base_path)

    if not supabase_path.exists():
        print(f"❌ Error: Path does not exist: {supabase_path}")
        return []

    for root, dirs, files in os.walk(supabase_path):
        for file in files:
            if file.endswith('.sql'):
                full_path = Path(root) / file
                rel_path = full_path.relative_to(supabase_path.parent)
                sql_files.append(str(rel_path))

    return sql_files


def check_duplicate_files(sql_files):
    """Check for duplicate or incorrectly placed SQL files."""
    errors = []
    warnings = []

    # Check for files in wrong locations
    setup_files = [f for f in sql_files if 'supabase/setup/' in f]
    other_files = [f for f in sql_files if 'supabase/setup/' not in f and 'supabase/migrations/' not in f]

    # Check for incorrect patterns in filenames
    for file in sql_files:
        filename = Path(file).name
        for pattern in INCORRECT_PATTERNS:
            if pattern in filename:
                errors.append(
                    f"❌ DUPLICATE FILE DETECTED: {file}\n"
                    f"   Pattern '{pattern}' suggests this is a duplicate.\n"
                    f"   Update existing files in supabase/setup/ instead."
                )

    # Check for multiple table definition files
    table_files = [f for f in sql_files if 'table' in Path(f).name.lower()]
    if len(table_files) > 1:
        if not all('supabase/setup/01_tables.sql' in f or 'migrations' in f for f in table_files):
            errors.append(
                f"❌ MULTIPLE TABLE FILES DETECTED:\n"
                + '\n'.join(f"   - {f}" for f in table_files) +
                f"\n   All tables should be in supabase/setup/01_tables.sql only."
            )

    # Check for SQL files outside setup and migrations
    if other_files:
        warnings.append(
            f"⚠️  SQL FILES OUTSIDE STANDARD LOCATIONS:\n"
            + '\n'.join(f"   - {f}" for f in other_files) +
            f"\n   Consider if these should be in supabase/setup/ or supabase/migrations/"
        )

    return errors, warnings


def check_setup_directory(sql_files):
    """Verify setup directory has correct files."""
    errors = []
    setup_files = [f for f in sql_files if 'supabase/setup/' in f]

    for file_type, correct_path in CORRECT_FILES.items():
        if correct_path not in sql_files:
            errors.append(
                f"❌ MISSING FILE: {correct_path}\n"
                f"   Required file for {file_type} is missing."
            )

    # Check for extra files in setup directory
    expected_files = set(CORRECT_FILES.values())
    actual_files = set(f for f in sql_files if 'supabase/setup/' in f)
    extra_files = actual_files - expected_files

    if extra_files:
        errors.append(
            f"❌ UNEXPECTED FILES IN SETUP DIRECTORY:\n"
            + '\n'.join(f"   - {f}" for f in extra_files) +
            f"\n   Only the 5 standard files should be in supabase/setup/"
        )

    return errors


def main():
    if len(sys.argv) > 1:
        base_path = sys.argv[1]
    else:
        # Default to current directory
        base_path = '.'

    print("🔍 Validating SQL file management...")
    print(f"   Base path: {os.path.abspath(base_path)}")
    print()

    # Find all SQL files
    sql_files = find_sql_files(base_path)

    if not sql_files:
        print("⚠️  No SQL files found.")
        return 0

    print(f"📄 Found {len(sql_files)} SQL files")
    print()

    # Run checks
    dup_errors, dup_warnings = check_duplicate_files(sql_files)
    setup_errors = check_setup_directory(sql_files)

    all_errors = dup_errors + setup_errors

    # Print results
    if dup_warnings:
        print("WARNINGS:")
        for warning in dup_warnings:
            print(warning)
            print()

    if all_errors:
        print("❌ VALIDATION FAILED")
        print()
        print("ERRORS FOUND:")
        for error in all_errors:
            print(error)
            print()
        print("💡 REMINDER:")
        print("   - NEVER create new SQL files for existing objects")
        print("   - Always check SQL_FILE_INDEX.md first")
        print("   - Update ONLY files in supabase/setup/")
        print("   - Tables → 01_tables.sql")
        print("   - Functions → 02_functions.sql")
        print("   - Policies → 03_policies.sql")
        print("   - Triggers → 04_triggers.sql")
        print("   - Views → 05_views.sql")
        return 1
    else:
        print("✅ ALL CHECKS PASSED")
        print()
        print("SQL file structure is correct:")
        for file_type, path in CORRECT_FILES.items():
            status = "✅" if path in sql_files else "⚠️ "
            print(f"   {status} {path}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
