# Brand Styling Skill

A comprehensive brand styling system for standardizing design across all web development projects.

## Overview

This skill provides a complete design system including:
- ✅ Brand colors with dark mode support
- ✅ Typography system (Google Fonts: Inter, Poppins)
- ✅ Spacing and layout standards
- ✅ Responsive breakpoints (mobile-first)
- ✅ Tailwind CSS configuration
- ✅ Next.js theme provider for dark mode
- ✅ Component styling patterns
- ✅ Accessibility guidelines
- ✅ Color palette generation tools

## Quick Start

### Installation

1. **Install Dependencies**
   ```bash
   npm install next-themes lucide-react
   ```

2. **Copy Configuration Files**
   - Copy `assets/tailwind.config.js` to your project root
   - Copy `assets/globals.css` to your styles directory
   - Copy `assets/theme-provider.tsx` to `components/providers/`
   - Copy `assets/theme-toggle.tsx` to `components/`

3. **Update Your Layout**
   ```tsx
   import { ThemeProvider } from '@/components/providers/theme-provider';
   import '@/styles/globals.css';

   export default function RootLayout({ children }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <body>
           <ThemeProvider>
             {children}
           </ThemeProvider>
         </body>
       </html>
     );
   }
   ```

## Brand Colors

### Primary: `#0b6d41` (Green)
- Main brand color
- Use for primary actions, links, active states

### Secondary: `#ffde59` (Yellow)
- Complementary accent color
- Use for highlights, warnings, badges

### Background: `#fbfbee` (Cream)
- Neutral background for light theme
- Use for page backgrounds, cards

## File Structure

```
brand-styling/
├── SKILL.md                    # Main skill documentation
├── README.md                   # This file
├── references/
│   ├── brand-guidelines.md     # Complete brand design system
│   └── dark-mode-patterns.md   # Dark mode implementation guide
├── assets/
│   ├── tailwind.config.js      # Tailwind configuration
│   ├── globals.css             # Global styles with CSS variables
│   ├── theme-provider.tsx      # Next.js theme provider
│   └── theme-toggle.tsx        # Theme toggle components
└── scripts/
    ├── generate-palette.py     # Color palette generator
    └── README.md              # Script documentation
```

## Usage Examples

### Using Brand Colors

```tsx
// Primary button
<button className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg">
  Primary Action
</button>

// Card with dark mode
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
  Card content
</div>

// Text with proper contrast
<p className="text-gray-900 dark:text-gray-50">
  Main content text
</p>
```

### Responsive Design

```tsx
<div className="
  grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
  gap-4 md:gap-6
  px-4 py-8 md:px-6 md:py-12
">
  {/* Responsive grid content */}
</div>
```

### Typography

```tsx
<h1 className="text-3xl md:text-4xl font-bold font-poppins text-gray-900 dark:text-gray-50">
  Page Title
</h1>

<p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
  Body text with comfortable reading experience.
</p>
```

## Documentation

### For Detailed Guidelines

- **Brand Guidelines**: See `references/brand-guidelines.md`
  - Complete color palette
  - Typography scales
  - Component patterns
  - Accessibility standards

- **Dark Mode Patterns**: See `references/dark-mode-patterns.md`
  - Implementation examples
  - Component-specific patterns
  - Testing checklist
  - Troubleshooting

### For Implementation

- **SKILL.md**: Main skill documentation
  - When to use this skill
  - Step-by-step implementation guide
  - Best practices
  - Quality checks

## Tools

### Color Palette Generator

Generate color variations and test accessibility:

```bash
# Generate palette
python scripts/generate-palette.py --color "#0b6d41" --name primary --format js

# Test contrast
python scripts/generate-palette.py --test-contrast "#0b6d41" "#ffffff"

# Generate all formats
python scripts/generate-palette.py --color "#0b6d41" --format all --output colors.md
```

See `scripts/README.md` for detailed usage.

## Features

### ✅ Complete Design System
- Predefined color palettes
- Typography scales
- Spacing system
- Component patterns

### ✅ Dark Mode Support
- Next.js themes integration
- Class-based dark mode
- System theme detection
- Smooth transitions

### ✅ Responsive Design
- Mobile-first approach
- Standard breakpoints
- Flexible layouts
- Touch-friendly

### ✅ Accessibility
- WCAG AA compliant colors
- Focus states
- Keyboard navigation
- Screen reader support

### ✅ Developer Experience
- Tailwind utilities
- Reusable components
- CSS variables
- TypeScript support

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS 12+, Android 5+

## Contributing

When extending this skill:

1. Follow existing naming conventions
2. Test in both light and dark modes
3. Verify accessibility compliance
4. Update relevant documentation
5. Add examples for new patterns

## Version History

**v1.0.0** (2025-01-16)
- Initial release
- Complete brand color system
- Dark mode implementation
- Typography and spacing standards
- Component patterns
- Color palette generator script

## Support

For questions or issues with this skill:

1. Review the documentation in `references/`
2. Check component patterns in SKILL.md
3. Test contrast ratios with the generator script
4. Refer to Tailwind CSS documentation for utilities

## License

This skill is part of the MyJKKN project brand guidelines.

---

**Created:** 2025-01-16
**Version:** 1.0.0
**Maintained by:** MyJKKN Web Development Team
