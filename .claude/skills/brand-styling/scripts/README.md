# Brand Styling Scripts

## generate-palette.py

A Python script to generate color palettes, create variations, and test accessibility compliance.

### Features

- **Generate Color Shades**: Creates a 9-shade palette from 50 (lightest) to 900 (darkest)
- **Opacity Variations**: Generates 10%, 20%, ..., 90% opacity variants
- **Contrast Testing**: Tests WCAG AA and AAA compliance against backgrounds
- **Multiple Output Formats**: JavaScript, CSS, JSON, and Tailwind config

### Requirements

- Python 3.6+
- No external dependencies (uses only Python standard library)

### Usage

#### Generate Color Palette

```bash
# Generate JavaScript format (default)
python generate-palette.py --color "#0b6d41" --name primary

# Generate CSS custom properties
python generate-palette.py --color "#ffde59" --name secondary --format css

# Generate Tailwind config
python generate-palette.py --color "#0b6d41" --format tailwind

# Generate all formats
python generate-palette.py --color "#0b6d41" --format all

# Save to file
python generate-palette.py --color "#0b6d41" --output colors.js
```

#### Test Contrast Ratios

```bash
# Test contrast between two colors
python generate-palette.py --test-contrast "#0b6d41" "#ffffff"

# Test against multiple backgrounds
python generate-palette.py --color "#0b6d41" --test-backgrounds "#ffffff" "#000000" "#fbfbee"
```

### Examples

#### Example 1: Generate Primary Color Palette

```bash
python generate-palette.py --color "#0b6d41" --name primary --format js --output src/styles/primary-colors.js
```

Output:
```javascript
// Primary Color Palette
export const primaryColors = {
  DEFAULT: '#0b6d41',

  // Shades
  50: '#f0fdf7',
  100: '#d4f1e4',
  200: '#a8e3c9',
  // ... more shades
  900: '#042010',

  // Opacity Variants
  opacity: {
    10: 'rgba(11, 109, 65, 0.1)',
    20: 'rgba(11, 109, 65, 0.2)',
    // ... more variants
  },
};
```

#### Example 2: Test Accessibility

```bash
python generate-palette.py --test-contrast "#0b6d41" "#ffffff"
```

Output:
```
Contrast Ratio: 6.81:1

WCAG AA Compliance:
  Normal Text (4.5:1): ✓ Pass
  Large Text (3:1): ✓ Pass

WCAG AAA Compliance:
  Normal Text (7:1): ✗ Fail
  Large Text (4.5:1): ✓ Pass
```

#### Example 3: Generate Brand Colors

```bash
# Primary color
python generate-palette.py --color "#0b6d41" --name primary --format tailwind --output primary.txt

# Secondary color
python generate-palette.py --color "#ffde59" --name secondary --format tailwind --output secondary.txt
```

### Output Formats

#### JavaScript (js)
Exports ES6 module with color object.

#### CSS (css)
CSS custom properties (variables) format.

#### JSON (json)
Pure JSON format for data storage or API responses.

#### Tailwind (tailwind)
Ready-to-use Tailwind config color object.

#### All (all)
Outputs all formats plus contrast test results.

### Command-Line Options

```
--color COLOR           Base color in hex format (required for palette generation)
--name NAME            Color name (default: primary)
--format FORMAT        Output format: js, css, json, tailwind, all (default: js)
--output FILE          Output file path (optional, prints to stdout if not specified)
--test-contrast C1 C2  Test contrast ratio between two colors
--test-backgrounds BG  Test contrast against multiple backgrounds (default: #ffffff #000000 #fbfbee)
```

### WCAG Contrast Standards

The script tests colors against WCAG (Web Content Accessibility Guidelines) standards:

**WCAG AA** (Minimum):
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio

**WCAG AAA** (Enhanced):
- Normal text: 7:1 contrast ratio
- Large text: 4.5:1 contrast ratio

### Tips

1. **Brand Colors**: Always test your brand colors against your primary backgrounds
2. **Dark Mode**: Generate separate palettes for dark mode variants if needed
3. **Documentation**: Save generated palettes for team reference
4. **Accessibility**: Ensure all text meets at least WCAG AA standards

### Common Workflows

#### Adding a New Brand Color

```bash
# 1. Generate the palette
python generate-palette.py --color "#your-color" --name your-color --format tailwind

# 2. Test accessibility
python generate-palette.py --test-contrast "#your-color" "#ffffff"
python generate-palette.py --test-contrast "#your-color" "#000000"

# 3. Add to Tailwind config
# Copy the output to tailwind.config.js theme.extend.colors
```

#### Updating Existing Colors

```bash
# 1. Generate updated palette
python generate-palette.py --color "#new-color" --name primary --format all --output docs/primary-colors.md

# 2. Review all formats and contrast ratios
# 3. Update relevant files (Tailwind config, CSS variables, etc.)
```

---

## Future Scripts

Additional scripts planned for this directory:

- `optimize-images.py` - Optimize brand assets for web
- `generate-favicons.py` - Generate favicon sizes from brand logo
- `validate-brand.py` - Validate brand color usage across project

---

**Need Help?**

Refer to the main SKILL.md for complete brand styling guidelines and usage instructions.
