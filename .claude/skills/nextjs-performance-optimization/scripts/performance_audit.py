#!/usr/bin/env python3
"""
Next.js Performance Audit Script

Runs a comprehensive performance audit on a Next.js application.
Checks build output, bundle sizes, and provides optimization recommendations.

Usage:
    python performance_audit.py [build-dir]

Examples:
    python performance_audit.py .next
    python performance_audit.py dist
"""

import os
import json
import sys
from pathlib import Path


def format_size(bytes_size):
    """Convert bytes to human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"


def analyze_build_output(build_dir):
    """Analyze Next.js build output directory."""
    build_path = Path(build_dir)

    if not build_path.exists():
        print(f"❌ Build directory not found: {build_dir}")
        print("Run 'npm run build' first to generate the build output.")
        return None

    results = {
        'total_size': 0,
        'js_bundles': [],
        'css_bundles': [],
        'pages': [],
        'issues': [],
        'recommendations': []
    }

    # Analyze static directory
    static_dir = build_path / 'static'
    if static_dir.exists():
        # Check JS bundles
        chunks_dir = static_dir / 'chunks'
        if chunks_dir.exists():
            for js_file in chunks_dir.rglob('*.js'):
                size = js_file.stat().st_size
                results['js_bundles'].append({
                    'name': js_file.name,
                    'size': size,
                    'path': str(js_file.relative_to(build_path))
                })
                results['total_size'] += size

        # Check CSS bundles
        css_dir = static_dir / 'css'
        if css_dir.exists():
            for css_file in css_dir.rglob('*.css'):
                size = css_file.stat().st_size
                results['css_bundles'].append({
                    'name': css_file.name,
                    'size': size,
                    'path': str(css_file.relative_to(build_path))
                })
                results['total_size'] += size

    # Analyze pages
    server_dir = build_path / 'server' / 'app'
    if server_dir.exists():
        for page_file in server_dir.rglob('*.js'):
            size = page_file.stat().st_size
            results['pages'].append({
                'name': str(page_file.relative_to(server_dir)),
                'size': size
            })

    # Generate recommendations
    generate_recommendations(results)

    return results


def generate_recommendations(results):
    """Generate optimization recommendations based on analysis."""
    # Check bundle sizes
    for bundle in results['js_bundles']:
        if bundle['size'] > 244_000:  # 244KB (gzipped ~80KB)
            results['issues'].append({
                'severity': 'high',
                'type': 'bundle_size',
                'message': f"Large JS bundle detected: {bundle['name']} ({format_size(bundle['size'])})",
                'file': bundle['path']
            })
            results['recommendations'].append(
                f"Consider code splitting or dynamic imports for {bundle['name']}"
            )

    # Check total bundle size
    total_js_size = sum(b['size'] for b in results['js_bundles'])
    if total_js_size > 500_000:  # 500KB
        results['issues'].append({
            'severity': 'high',
            'type': 'total_size',
            'message': f"Total JS bundle size is large: {format_size(total_js_size)}"
        })
        results['recommendations'].extend([
            "Enable optimizePackageImports in next.config.js",
            "Review and remove unused dependencies",
            "Use dynamic imports for heavy components",
            "Consider using lighter alternatives for large libraries"
        ])

    # Check for optimization opportunities
    if len(results['js_bundles']) < 3:
        results['recommendations'].append(
            "Consider implementing code splitting to create more smaller chunks"
        )

    # Check CSS size
    total_css_size = sum(b['size'] for b in results['css_bundles'])
    if total_css_size > 100_000:  # 100KB
        results['issues'].append({
            'severity': 'medium',
            'type': 'css_size',
            'message': f"Large CSS bundle: {format_size(total_css_size)}"
        })
        results['recommendations'].append(
            "Review CSS for unused styles and consider purging"
        )


def print_report(results):
    """Print formatted performance report."""
    print("\n" + "="*70)
    print("  NEXT.JS PERFORMANCE AUDIT REPORT")
    print("="*70 + "\n")

    # Summary
    print("📊 SUMMARY")
    print("-" * 70)
    print(f"Total Build Size:     {format_size(results['total_size'])}")
    print(f"JS Bundles:           {len(results['js_bundles'])} files")
    print(f"CSS Bundles:          {len(results['css_bundles'])} files")
    print(f"Pages Analyzed:       {len(results['pages'])} pages")
    print(f"Issues Found:         {len(results['issues'])}\n")

    # Issues
    if results['issues']:
        print("⚠️  ISSUES DETECTED")
        print("-" * 70)
        for issue in results['issues']:
            severity_icon = "🔴" if issue['severity'] == 'high' else "🟡"
            print(f"{severity_icon} [{issue['type'].upper()}] {issue['message']}")
            if 'file' in issue:
                print(f"   File: {issue['file']}")
        print()

    # Top 5 largest bundles
    if results['js_bundles']:
        print("📦 TOP 5 LARGEST JS BUNDLES")
        print("-" * 70)
        sorted_bundles = sorted(results['js_bundles'], key=lambda x: x['size'], reverse=True)[:5]
        for i, bundle in enumerate(sorted_bundles, 1):
            print(f"{i}. {bundle['name']:<40} {format_size(bundle['size']):>12}")
        print()

    # Recommendations
    if results['recommendations']:
        print("💡 RECOMMENDATIONS")
        print("-" * 70)
        for i, rec in enumerate(results['recommendations'], 1):
            print(f"{i}. {rec}")
        print()

    # Performance checklist
    print("✅ PERFORMANCE CHECKLIST")
    print("-" * 70)
    total_js = sum(b['size'] for b in results['js_bundles'])
    total_css = sum(b['size'] for b in results['css_bundles'])

    checklist = [
        ("Initial JS bundle < 200KB", total_js < 200_000),
        ("Total CSS < 50KB", total_css < 50_000),
        ("Using code splitting (3+ chunks)", len(results['js_bundles']) >= 3),
        ("No bundles > 244KB", all(b['size'] <= 244_000 for b in results['js_bundles']))
    ]

    for item, passed in checklist:
        status = "✓" if passed else "✗"
        print(f"  [{status}] {item}")

    print("\n" + "="*70)
    print("  For detailed optimization strategies, see the skill documentation")
    print("="*70 + "\n")


def main():
    """Main entry point."""
    build_dir = sys.argv[1] if len(sys.argv) > 1 else '.next'

    print(f"🔍 Analyzing Next.js build output in: {build_dir}\n")

    results = analyze_build_output(build_dir)

    if results:
        print_report(results)

        # Exit with error code if critical issues found
        critical_issues = [i for i in results['issues'] if i['severity'] == 'high']
        if critical_issues:
            print(f"⚠️  Found {len(critical_issues)} critical performance issues")
            sys.exit(1)
        else:
            print("✅ No critical performance issues detected")
            sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
