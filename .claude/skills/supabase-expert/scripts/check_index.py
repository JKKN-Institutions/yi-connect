#!/usr/bin/env python3
"""
Check SQL_FILE_INDEX.md

Verifies that SQL_FILE_INDEX.md is up to date with actual SQL files.
Ensures documentation matches reality.

Usage:
    python check_index.py [path/to/supabase]

Returns:
    0 - Index is up to date
    1 - Index is outdated or has issues
"""

import sys
import os
import re
from pathlib import Path
from datetime import datetime


def read_index_file(base_path):
    """Read and parse SQL_FILE_INDEX.md."""
    index_path = Path(base_path) / 'supabase' / 'SQL_FILE_INDEX.md'

    if not index_path.exists():
        print(f"❌ ERROR: SQL_FILE_INDEX.md not found at {index_path}")
        return None

    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read()

    return content


def extract_tables_from_index(content):
    """Extract table names mentioned in the index."""
    if not content:
        return []

    # Look for table entries (lines with table names in backticks or headers)
    table_pattern = r'`(\w+)`|### (\w+)'
    matches = re.findall(table_pattern, content)

    tables = []
    for match in matches:
        table_name = match[0] or match[1]
        if table_name and not table_name.startswith('File'):
            tables.append(table_name)

    return list(set(tables))


def extract_tables_from_sql(base_path):
    """Extract table names from actual SQL files."""
    tables_file = Path(base_path) / 'supabase' / 'setup' / '01_tables.sql'

    if not tables_file.exists():
        print(f"⚠️  WARNING: {tables_file} not found")
        return []

    with open(tables_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Look for CREATE TABLE statements
    table_pattern = r'CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?(\w+)'
    matches = re.findall(table_pattern, content, re.IGNORECASE)

    return list(set(matches))


def check_last_updated(content):
    """Check when the index was last updated."""
    if not content:
        return None

    # Look for Last Updated date
    date_pattern = r'Last Updated:?\s*(\d{4}-\d{2}-\d{2})'
    match = re.search(date_pattern, content, re.IGNORECASE)

    if match:
        date_str = match.group(1)
        try:
            last_updated = datetime.strptime(date_str, '%Y-%m-%d')
            days_old = (datetime.now() - last_updated).days
            return days_old
        except ValueError:
            return None

    return None


def main():
    if len(sys.argv) > 1:
        base_path = sys.argv[1]
    else:
        base_path = '.'

    print("📋 Checking SQL_FILE_INDEX.md...")
    print(f"   Base path: {os.path.abspath(base_path)}")
    print()

    # Read index
    index_content = read_index_file(base_path)
    if not index_content:
        return 1

    print("✅ SQL_FILE_INDEX.md found")

    # Check last updated date
    days_old = check_last_updated(index_content)
    if days_old is not None:
        print(f"📅 Last updated: {days_old} days ago")
        if days_old > 30:
            print(f"   ⚠️  Index may be outdated (>30 days old)")
    else:
        print("⚠️  Could not determine last update date")

    print()

    # Extract tables from both sources
    index_tables = extract_tables_from_index(index_content)
    sql_tables = extract_tables_from_sql(base_path)

    print(f"📊 Tables in index: {len(index_tables)}")
    print(f"📊 Tables in SQL: {len(sql_tables)}")
    print()

    # Compare
    missing_from_index = set(sql_tables) - set(index_tables)
    missing_from_sql = set(index_tables) - set(sql_tables)

    errors = []

    if missing_from_index:
        errors.append(
            "❌ TABLES MISSING FROM INDEX:\n"
            + '\n'.join(f"   - {table}" for table in sorted(missing_from_index)) +
            "\n   These tables exist in SQL but are not documented in SQL_FILE_INDEX.md"
        )

    if missing_from_sql:
        errors.append(
            "⚠️  TABLES IN INDEX BUT NOT IN SQL:\n"
            + '\n'.join(f"   - {table}" for table in sorted(missing_from_sql)) +
            "\n   These tables are documented but don't exist in 01_tables.sql"
        )

    # Print results
    if errors:
        print("❌ INDEX IS OUTDATED")
        print()
        for error in errors:
            print(error)
            print()
        print("💡 ACTION REQUIRED:")
        print("   Update SQL_FILE_INDEX.md to match actual SQL files")
        print("   Add missing tables to the index")
        print("   Remove references to non-existent tables")
        print(f"   Update 'Last Updated' date to {datetime.now().strftime('%Y-%m-%d')}")
        return 1
    else:
        print("✅ INDEX IS UP TO DATE")
        print()
        if sql_tables:
            print("Documented tables:")
            for table in sorted(sql_tables)[:10]:  # Show first 10
                print(f"   ✅ {table}")
            if len(sql_tables) > 10:
                print(f"   ... and {len(sql_tables) - 10} more")
        return 0


if __name__ == "__main__":
    sys.exit(main())
