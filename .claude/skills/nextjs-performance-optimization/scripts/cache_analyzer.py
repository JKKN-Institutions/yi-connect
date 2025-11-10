#!/usr/bin/env python3
"""
Next.js Cache Strategy Analyzer

Analyzes caching patterns in Next.js 16+ applications.
Identifies missing cache configurations and optimization opportunities.

Usage:
    python cache_analyzer.py [directory]

Examples:
    python cache_analyzer.py app
    python cache_analyzer.py src/app
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict


class CacheAnalyzer:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.findings = {
            'uncached_fetches': [],
            'missing_cache_tags': [],
            'missing_cache_components': [],
            'optimal_patterns': [],
            'warnings': []
        }
        self.file_count = 0

    def analyze_fetch_caching(self, file_path, content):
        """Analyze fetch caching patterns."""
        # Find all fetch calls
        fetch_pattern = r'fetch\s*\([^)]+(?:,\s*({[^}]+}))?\)'

        for match in re.finditer(fetch_pattern, content):
            line_num = content[:match.start()].count('\n') + 1
            fetch_call = match.group()
            options = match.group(1) if match.group(1) else ''

            # Check if fetch has cache configuration
            has_cache = 'cache:' in options or 'next:' in options

            if not has_cache:
                self.findings['uncached_fetches'].append({
                    'file': str(file_path),
                    'line': line_num,
                    'severity': 'medium',
                    'suggestion': 'Add cache configuration: { next: { revalidate: <seconds> } } or { cache: "force-cache" }'
                })
            else:
                # Check if using tags for granular invalidation
                has_tags = 'tags:' in options
                if not has_tags and 'next:' in options:
                    self.findings['missing_cache_tags'].append({
                        'file': str(file_path),
                        'line': line_num,
                        'severity': 'low',
                        'suggestion': 'Consider adding cache tags for granular invalidation: tags: ["resource-name"]'
                    })
                else:
                    self.findings['optimal_patterns'].append({
                        'file': str(file_path),
                        'line': line_num,
                        'pattern': 'Fetch with cache configuration'
                    })

    def analyze_cache_components(self, file_path, content):
        """Analyze Cache Component usage (Next.js 16+)."""
        # Check for async components that could use 'use cache'
        is_async_component = re.search(r'async\s+function\s+\w+\s*\([^)]*\)\s*{', content)

        if is_async_component:
            has_use_cache = "'use cache'" in content or '"use cache"' in content

            # Check if component has expensive operations
            has_expensive_ops = any(pattern in content for pattern in [
                'fetch(',
                'await ',
                'db.',
                'prisma.',
                'supabase.'
            ])

            if has_expensive_ops and not has_use_cache:
                line_num = content[:is_async_component.start()].count('\n') + 1
                self.findings['missing_cache_components'].append({
                    'file': str(file_path),
                    'line': line_num,
                    'severity': 'high',
                    'suggestion': "Add 'use cache' directive at function top for component-level caching"
                })

    def analyze_cache_life(self, file_path, content):
        """Analyze cacheLife usage."""
        has_use_cache = "'use cache'" in content or '"use cache"' in content

        if has_use_cache:
            has_cache_life = 'cacheLife(' in content

            if not has_cache_life:
                self.findings['warnings'].append({
                    'file': str(file_path),
                    'line': 1,
                    'severity': 'low',
                    'message': 'Consider using cacheLife() to specify cache duration',
                    'suggestion': "Add: cacheLife('hours') or custom profile"
                })

    def analyze_cache_tags(self, file_path, content):
        """Analyze cache tag usage."""
        has_use_cache = "'use cache'" in content or '"use cache"' in content

        if has_use_cache:
            has_cache_tag = 'cacheTag(' in content

            # If component fetches dynamic data, it should have tags
            has_dynamic_data = any(pattern in content for pattern in [
                r'\${',  # Template literals for dynamic URLs
                'params.',
                'searchParams.'
            ])

            if has_dynamic_data and not has_cache_tag:
                self.findings['warnings'].append({
                    'file': str(file_path),
                    'line': 1,
                    'severity': 'medium',
                    'message': 'Dynamic data without cache tags',
                    'suggestion': 'Add cacheTag() for granular cache invalidation'
                })

    def analyze_revalidation(self, file_path, content):
        """Analyze revalidation patterns."""
        # Check for Server Actions
        has_use_server = "'use server'" in content or '"use server"' in content

        if has_use_server:
            # Check if Server Action performs mutations
            has_mutations = any(pattern in content for pattern in [
                r'\.create\(',
                r'\.update\(',
                r'\.delete\(',
                r'\.insert\(',
                'INSERT ',
                'UPDATE ',
                'DELETE '
            ])

            if has_mutations:
                # Check for revalidation calls
                has_revalidate = 'revalidatePath' in content or 'revalidateTag' in content

                if not has_revalidate:
                    self.findings['warnings'].append({
                        'file': str(file_path),
                        'line': 1,
                        'severity': 'high',
                        'message': 'Server Action with mutations but no revalidation',
                        'suggestion': 'Add revalidatePath() or revalidateTag() after mutations'
                    })

    def analyze_file(self, file_path):
        """Analyze a single file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            self.file_count += 1

            # Run all analyses
            self.analyze_fetch_caching(file_path, content)
            self.analyze_cache_components(file_path, content)
            self.analyze_cache_life(file_path, content)
            self.analyze_cache_tags(file_path, content)
            self.analyze_revalidation(file_path, content)

        except Exception as e:
            print(f"Warning: Could not analyze {file_path}: {e}")

    def scan_directory(self):
        """Scan directory for cache patterns."""
        extensions = {'.tsx', '.jsx', '.ts', '.js'}

        for file_path in self.directory.rglob('*'):
            if file_path.suffix in extensions:
                # Skip node_modules and build directories
                if any(skip in file_path.parts for skip in ['node_modules', '.next', 'dist']):
                    continue
                self.analyze_file(file_path)

    def print_report(self):
        """Print formatted report."""
        print("\n" + "="*70)
        print("  NEXT.JS CACHE STRATEGY ANALYSIS")
        print("="*70 + "\n")

        print(f"📁 Files Analyzed: {self.file_count}\n")

        # Uncached fetches
        if self.findings['uncached_fetches']:
            print(f"🟡 UNCACHED FETCH CALLS ({len(self.findings['uncached_fetches'])})")
            print("-" * 70)
            for finding in self.findings['uncached_fetches'][:5]:  # Show top 5
                print(f"   {finding['file']}:{finding['line']}")
                print(f"   💡 {finding['suggestion']}\n")
            if len(self.findings['uncached_fetches']) > 5:
                print(f"   ... and {len(self.findings['uncached_fetches']) - 5} more\n")

        # Missing cache components
        if self.findings['missing_cache_components']:
            print(f"🔴 MISSING CACHE COMPONENTS ({len(self.findings['missing_cache_components'])})")
            print("-" * 70)
            for finding in self.findings['missing_cache_components']:
                print(f"   {finding['file']}:{finding['line']}")
                print(f"   💡 {finding['suggestion']}\n")

        # Missing cache tags
        if self.findings['missing_cache_tags']:
            print(f"🟢 OPTIMIZATION OPPORTUNITIES ({len(self.findings['missing_cache_tags'])})")
            print("-" * 70)
            for finding in self.findings['missing_cache_tags'][:3]:  # Show top 3
                print(f"   {finding['file']}:{finding['line']}")
                print(f"   💡 {finding['suggestion']}\n")

        # Warnings
        if self.findings['warnings']:
            print(f"⚠️  WARNINGS ({len(self.findings['warnings'])})")
            print("-" * 70)
            for finding in self.findings['warnings']:
                severity_icon = {
                    'high': '🔴',
                    'medium': '🟡',
                    'low': '🟢'
                }.get(finding['severity'], '⚪')
                print(f"{severity_icon} {finding['message']}")
                print(f"   {finding['file']}:{finding['line']}")
                print(f"   💡 {finding['suggestion']}\n")

        # Optimal patterns found
        if self.findings['optimal_patterns']:
            print(f"✅ OPTIMAL PATTERNS FOUND ({len(self.findings['optimal_patterns'])})")
            print("-" * 70)
            print(f"   Great job! Found {len(self.findings['optimal_patterns'])} properly cached operations.\n")

        # Summary
        total_issues = (
            len(self.findings['uncached_fetches']) +
            len(self.findings['missing_cache_components']) +
            len(self.findings['warnings'])
        )

        print("="*70)
        print(f"  Total Issues: {total_issues}")
        print("="*70 + "\n")

        # Recommendations
        print("💡 CACHING BEST PRACTICES:")
        print("1. Use 'use cache' directive for expensive async Server Components")
        print("2. Add { next: { revalidate: N } } to all fetch calls")
        print("3. Use cache tags for granular invalidation")
        print("4. Call revalidatePath/revalidateTag after data mutations")
        print("5. Use cacheLife() to specify optimal cache durations\n")

        print("📚 CACHE PROFILES (Next.js 16+):")
        print("   - cacheLife('seconds')  - Very dynamic data")
        print("   - cacheLife('minutes')  - Frequently updated")
        print("   - cacheLife('hours')    - Moderately dynamic")
        print("   - cacheLife('days')     - Mostly static")
        print("   - cacheLife('weeks')    - Rarely changes")
        print("   - cacheLife('max')      - Static content\n")


def main():
    """Main entry point."""
    directory = sys.argv[1] if len(sys.argv) > 1 else 'app'

    if not os.path.exists(directory):
        print(f"❌ Directory not found: {directory}")
        sys.exit(1)

    print(f"🔍 Analyzing cache strategies in: {directory}\n")

    analyzer = CacheAnalyzer(directory)
    analyzer.scan_directory()
    analyzer.print_report()


if __name__ == "__main__":
    main()
