#!/usr/bin/env python3
"""
Core Web Vitals Checker for Next.js

Analyzes code patterns that may impact Core Web Vitals scores.
Checks for common performance anti-patterns and provides recommendations.

Usage:
    python web_vitals_checker.py [directory]

Examples:
    python web_vitals_checker.py app
    python web_vitals_checker.py src
"""

import os
import re
import sys
from pathlib import Path
from collections import defaultdict


class WebVitalsChecker:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.findings = defaultdict(list)
        self.file_count = 0

    def check_lcp_issues(self, file_path, content):
        """Check for Largest Contentful Paint issues."""
        # Check for missing priority on hero images
        img_pattern = r'<Image[^>]*src=["\'][^"\']*hero[^"\']*["\'][^>]*>'
        for match in re.finditer(img_pattern, content, re.IGNORECASE):
            if 'priority' not in match.group() and 'preload' not in match.group():
                self.findings['LCP'].append({
                    'file': str(file_path),
                    'issue': 'Hero image missing priority/preload',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'high',
                    'fix': 'Add priority={true} to Image component'
                })

        # Check for large images without size optimization
        img_without_quality = r'<Image[^>]*(?!quality=)[^>]*>'
        for match in re.finditer(img_without_quality, content):
            if 'src=' in match.group():
                self.findings['LCP'].append({
                    'file': str(file_path),
                    'issue': 'Image without quality optimization',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'medium',
                    'fix': 'Consider adding quality={85} for optimized images'
                })

    def check_cls_issues(self, file_path, content):
        """Check for Cumulative Layout Shift issues."""
        # Check for images without dimensions
        img_without_dimensions = r'<Image[^>]*src=[^>]*(?!width=)(?!height=)[^>]*/?>'
        for match in re.finditer(img_without_dimensions, content):
            if 'fill' not in match.group():
                self.findings['CLS'].append({
                    'file': str(file_path),
                    'issue': 'Image without width/height',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'high',
                    'fix': 'Add width and height props to prevent layout shift'
                })

        # Check for fonts without display swap
        font_without_display = r'import.*from ["\']next/font/google["\']'
        if re.search(font_without_display, content):
            if 'display:' not in content and "display:" not in content:
                self.findings['CLS'].append({
                    'file': str(file_path),
                    'issue': 'Font without display strategy',
                    'line': 1,
                    'severity': 'medium',
                    'fix': "Add display: 'swap' to font configuration"
                })

    def check_fid_issues(self, file_path, content):
        """Check for First Input Delay issues."""
        # Check for heavy computation in render
        heavy_loops = r'for\s*\([^)]*\)\s*{[^}]{200,}}'
        for match in re.finditer(heavy_loops, content):
            self.findings['FID'].append({
                'file': str(file_path),
                'issue': 'Heavy computation in render path',
                'line': content[:match.start()].count('\n') + 1,
                'severity': 'medium',
                'fix': 'Consider using useMemo or moving to Server Component'
            })

        # Check for missing memoization on expensive functions
        expensive_pattern = r'const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{[^}]{500,}}'
        for match in re.finditer(expensive_pattern, content):
            if 'useMemo' not in content[:match.start()]:
                self.findings['FID'].append({
                    'file': str(file_path),
                    'issue': 'Potentially expensive function without memoization',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'low',
                    'fix': 'Consider wrapping with useMemo if recalculated frequently'
                })

    def check_ttfb_issues(self, file_path, content):
        """Check for Time to First Byte issues."""
        # Check for blocking data fetches
        if 'async function' in content and 'await fetch' in content:
            # Check for sequential awaits
            sequential_awaits = r'await\s+fetch[^;]+;\s*await\s+fetch'
            for match in re.finditer(sequential_awaits, content):
                self.findings['TTFB'].append({
                    'file': str(file_path),
                    'issue': 'Sequential fetch calls blocking render',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'high',
                    'fix': 'Use Promise.all() to parallelize fetch requests'
                })

        # Check for missing cache configuration
        if 'fetch(' in content:
            # Simple check for fetch without cache config
            fetch_pattern = r'fetch\([^)]+\)(?!\s*,\s*{[^}]*cache)'
            matches = list(re.finditer(fetch_pattern, content))
            if matches and 'next:' not in content:
                self.findings['TTFB'].append({
                    'file': str(file_path),
                    'issue': 'Fetch without cache configuration',
                    'line': content[:matches[0].start()].count('\n') + 1,
                    'severity': 'medium',
                    'fix': 'Add cache configuration: { next: { revalidate: 3600 } }'
                })

    def check_bundle_size_issues(self, file_path, content):
        """Check for patterns that increase bundle size."""
        # Check for full library imports
        heavy_imports = [
            (r'import\s+{[^}]+}\s+from\s+["\']@mui/material["\']', '@mui/material', 'Import specific components'),
            (r'import\s+{[^}]+}\s+from\s+["\']lodash["\']', 'lodash', 'Use lodash-es or import specific functions'),
            (r'import\s+\*\s+as\s+\w+\s+from', 'namespace import', 'Avoid namespace imports for better tree-shaking'),
        ]

        for pattern, lib, fix in heavy_imports:
            for match in re.finditer(pattern, content):
                self.findings['Bundle Size'].append({
                    'file': str(file_path),
                    'issue': f'Non-optimized import from {lib}',
                    'line': content[:match.start()].count('\n') + 1,
                    'severity': 'medium',
                    'fix': fix
                })

        # Check for missing dynamic imports on heavy components
        if "'use client'" in content or '"use client"' in content:
            # Check for heavy libraries in client components
            heavy_libs = ['chart', 'editor', 'pdf', 'map', 'markdown']
            for lib in heavy_libs:
                if lib.lower() in content.lower():
                    if 'dynamic(' not in content:
                        self.findings['Bundle Size'].append({
                            'file': str(file_path),
                            'issue': f'Heavy library ({lib}) in client component without dynamic import',
                            'line': 1,
                            'severity': 'high',
                            'fix': 'Consider using next/dynamic for code splitting'
                        })
                        break

    def analyze_file(self, file_path):
        """Analyze a single file for Web Vitals issues."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            self.file_count += 1

            # Run all checks
            if file_path.suffix in ['.tsx', '.jsx']:
                self.check_lcp_issues(file_path, content)
                self.check_cls_issues(file_path, content)
                self.check_fid_issues(file_path, content)

            if file_path.suffix in ['.tsx', '.jsx', '.ts', '.js']:
                self.check_ttfb_issues(file_path, content)
                self.check_bundle_size_issues(file_path, content)

        except Exception as e:
            print(f"Warning: Could not analyze {file_path}: {e}")

    def scan_directory(self):
        """Scan directory for performance issues."""
        extensions = {'.tsx', '.jsx', '.ts', '.js'}

        for file_path in self.directory.rglob('*'):
            if file_path.suffix in extensions:
                # Skip node_modules and .next
                if 'node_modules' in file_path.parts or '.next' in file_path.parts:
                    continue
                self.analyze_file(file_path)

    def print_report(self):
        """Print formatted report."""
        print("\n" + "="*70)
        print("  CORE WEB VITALS ANALYSIS REPORT")
        print("="*70 + "\n")

        print(f"📁 Files Analyzed: {self.file_count}\n")

        if not any(self.findings.values()):
            print("✅ No Web Vitals issues detected!\n")
            return

        # Group by metric
        for metric in ['LCP', 'CLS', 'FID', 'TTFB', 'Bundle Size']:
            if metric in self.findings and self.findings[metric]:
                issues = self.findings[metric]
                print(f"{'🔴' if any(i['severity'] == 'high' for i in issues) else '🟡'} {metric} Issues ({len(issues)})")
                print("-" * 70)

                for issue in issues:
                    severity_icon = {
                        'high': '🔴',
                        'medium': '🟡',
                        'low': '🟢'
                    }.get(issue['severity'], '⚪')

                    print(f"{severity_icon} {issue['issue']}")
                    print(f"   File: {issue['file']}:{issue['line']}")
                    print(f"   Fix: {issue['fix']}")
                    print()

        # Summary
        total_issues = sum(len(issues) for issues in self.findings.values())
        critical = sum(1 for issues in self.findings.values() for i in issues if i['severity'] == 'high')

        print("="*70)
        print(f"  Total Issues: {total_issues} | Critical: {critical}")
        print("="*70 + "\n")

        print("💡 NEXT STEPS:")
        print("1. Address critical (🔴) issues first for immediate impact")
        print("2. Run Lighthouse or PageSpeed Insights to measure actual scores")
        print("3. Test on real devices with network throttling")
        print("4. Monitor Core Web Vitals in production with analytics\n")


def main():
    """Main entry point."""
    directory = sys.argv[1] if len(sys.argv) > 1 else 'app'

    if not os.path.exists(directory):
        print(f"❌ Directory not found: {directory}")
        sys.exit(1)

    print(f"🔍 Analyzing Core Web Vitals patterns in: {directory}\n")

    checker = WebVitalsChecker(directory)
    checker.scan_directory()
    checker.print_report()


if __name__ == "__main__":
    main()
