#!/usr/bin/env python3
"""
Next.js 16 Project Structure Validator

Validates that a Next.js 16 project follows team standards:
- Required directory structure
- next.config.ts with cacheComponents enabled
- Supabase client setup
- Standard utilities (cn, auth)
- Environment variables configured

Usage:
    python validate_structure.py [path-to-project]

Examples:
    python validate_structure.py
    python validate_structure.py /path/to/project
"""

import sys
import os
from pathlib import Path

class ProjectValidator:
    def __init__(self, project_path):
        self.project_path = Path(project_path).resolve()
        self.errors = []
        self.warnings = []
        self.passed = []

    def validate(self):
        """Run all validation checks"""
        print(f"🔍 Validating Next.js 16 project at: {self.project_path}")
        print("")

        self.check_directory_structure()
        self.check_next_config()
        self.check_supabase_setup()
        self.check_utilities()
        self.check_env_files()
        self.check_package_json()

        self.print_results()

    def check_directory_structure(self):
        """Verify required directories exist"""
        required_dirs = [
            'app',
            'app/actions',
            'lib/supabase',
            'lib/data',
            'lib/utils',
            'components',
            'types',
        ]

        recommended_dirs = [
            'app/(auth)',
            'app/(dashboard)',
            'app/api',
            'lib/validations',
            'lib/hooks',
            'components/ui',
            'components/shared',
            'components/forms',
            'config',
        ]

        for dir_path in required_dirs:
            full_path = self.project_path / dir_path
            if full_path.exists():
                self.passed.append(f"Directory exists: {dir_path}")
            else:
                self.errors.append(f"Missing required directory: {dir_path}")

        for dir_path in recommended_dirs:
            full_path = self.project_path / dir_path
            if not full_path.exists():
                self.warnings.append(f"Recommended directory missing: {dir_path}")

    def check_next_config(self):
        """Verify next.config.ts exists and has cacheComponents"""
        config_file = self.project_path / 'next.config.ts'

        if not config_file.exists():
            config_file = self.project_path / 'next.config.js'

        if not config_file.exists():
            self.errors.append("Missing next.config.ts (or .js)")
            return

        try:
            content = config_file.read_text()

            if 'cacheComponents' in content and 'cacheComponents: true' in content:
                self.passed.append("Cache Components enabled in next.config")
            else:
                self.warnings.append("Cache Components not enabled in next.config")

            if 'cacheLife' in content:
                self.passed.append("Cache lifecycle profiles configured")
            else:
                self.warnings.append("Cache lifecycle profiles not configured")

        except Exception as e:
            self.errors.append(f"Could not read next.config: {e}")

    def check_supabase_setup(self):
        """Verify Supabase clients are properly set up"""
        server_client = self.project_path / 'lib' / 'supabase' / 'server.ts'
        client_client = self.project_path / 'lib' / 'supabase' / 'client.ts'

        if server_client.exists():
            try:
                content = server_client.read_text()
                if 'createServerClient' in content and '@supabase/ssr' in content:
                    self.passed.append("Supabase server client configured")
                else:
                    self.errors.append("Supabase server client missing proper imports")
            except:
                self.errors.append("Could not read Supabase server client")
        else:
            self.errors.append("Missing lib/supabase/server.ts")

        if client_client.exists():
            try:
                content = client_client.read_text()
                if 'createBrowserClient' in content:
                    self.passed.append("Supabase browser client configured")
                else:
                    self.errors.append("Supabase browser client missing proper imports")
            except:
                self.errors.append("Could not read Supabase browser client")
        else:
            self.errors.append("Missing lib/supabase/client.ts")

    def check_utilities(self):
        """Check for standard utility files"""
        # Check for auth utilities
        auth_file = self.project_path / 'lib' / 'auth.ts'
        if auth_file.exists():
            try:
                content = auth_file.read_text()
                if 'getCurrentUser' in content and 'requireAuth' in content:
                    self.passed.append("Auth utilities configured")
                else:
                    self.warnings.append("Auth utilities incomplete")
            except:
                self.warnings.append("Could not read auth utilities")
        else:
            self.warnings.append("Missing lib/auth.ts")

        # Check for cn utility
        cn_file = self.project_path / 'lib' / 'utils' / 'cn.ts'
        if cn_file.exists():
            self.passed.append("cn utility exists")
        else:
            self.warnings.append("Missing lib/utils/cn.ts (recommended for Tailwind)")

    def check_env_files(self):
        """Check for environment variable files"""
        env_local = self.project_path / '.env.local'
        env_example = self.project_path / '.env.example'

        if env_local.exists():
            try:
                content = env_local.read_text()
                if 'NEXT_PUBLIC_SUPABASE_URL' in content:
                    self.passed.append("Supabase URL configured in .env.local")
                else:
                    self.warnings.append("Missing Supabase URL in .env.local")

                if 'NEXT_PUBLIC_SUPABASE_ANON_KEY' in content:
                    self.passed.append("Supabase anon key configured in .env.local")
                else:
                    self.warnings.append("Missing Supabase anon key in .env.local")
            except:
                self.errors.append("Could not read .env.local")
        else:
            self.warnings.append("Missing .env.local file")

        if not env_example.exists():
            self.warnings.append("Missing .env.example (recommended for team)")

    def check_package_json(self):
        """Verify package.json has required dependencies"""
        package_json = self.project_path / 'package.json'

        if not package_json.exists():
            self.errors.append("Missing package.json")
            return

        try:
            import json
            data = json.loads(package_json.read_text())
            deps = data.get('dependencies', {})

            required_deps = {
                'next': '16',
                '@supabase/supabase-js': None,
                '@supabase/ssr': None,
                'zod': None,
            }

            for dep, min_version in required_deps.items():
                if dep in deps:
                    self.passed.append(f"Dependency installed: {dep}")
                else:
                    self.errors.append(f"Missing required dependency: {dep}")

            recommended_deps = [
                'react-hook-form',
                '@hookform/resolvers',
                'clsx',
                'tailwind-merge',
            ]

            for dep in recommended_deps:
                if dep not in deps:
                    self.warnings.append(f"Recommended dependency missing: {dep}")

        except Exception as e:
            self.errors.append(f"Could not read package.json: {e}")

    def print_results(self):
        """Print validation results"""
        print("")
        print("=" * 60)
        print("VALIDATION RESULTS")
        print("=" * 60)
        print("")

        if self.passed:
            print(f"✅ Passed ({len(self.passed)}):")
            for item in self.passed:
                print(f"   • {item}")
            print("")

        if self.warnings:
            print(f"⚠️  Warnings ({len(self.warnings)}):")
            for item in self.warnings:
                print(f"   • {item}")
            print("")

        if self.errors:
            print(f"❌ Errors ({len(self.errors)}):")
            for item in self.errors:
                print(f"   • {item}")
            print("")

        print("=" * 60)
        print("")

        if self.errors:
            print("❌ Validation FAILED")
            print("   Fix the errors above to ensure project follows team standards.")
            return False
        elif self.warnings:
            print("⚠️  Validation PASSED with warnings")
            print("   Consider addressing warnings for best practices.")
            return True
        else:
            print("✅ Validation PASSED")
            print("   Project follows all team standards!")
            return True

def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else '.'

    validator = ProjectValidator(project_path)
    success = validator.validate()

    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
