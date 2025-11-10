#!/usr/bin/env python3
"""
Color Palette Generator

This script generates color variations, opacity levels, and tests contrast ratios
for accessibility compliance (WCAG AA/AAA standards).

Usage:
    python generate-palette.py --color "#0b6d41" --output colors.js
    python generate-palette.py --color "#0b6d41" --format css
    python generate-palette.py --test-contrast "#0b6d41" "#ffffff"

Features:
- Generate lighter/darker shades
- Create opacity variations
- Test WCAG contrast ratios
- Output in multiple formats (JS, CSS, JSON)
"""

import argparse
import colorsys
import json
import sys
from typing import Tuple, Dict, List


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
    """Convert RGB tuple to hex color."""
    return '#{:02x}{:02x}{:02x}'.format(*rgb)


def rgb_to_hsl(rgb: Tuple[int, int, int]) -> Tuple[float, float, float]:
    """Convert RGB to HSL."""
    r, g, b = [x / 255.0 for x in rgb]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h * 360, s * 100, l * 100)


def hsl_to_rgb(hsl: Tuple[float, float, float]) -> Tuple[int, int, int]:
    """Convert HSL to RGB."""
    h, s, l = hsl[0] / 360, hsl[1] / 100, hsl[2] / 100
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return (int(r * 255), int(g * 255), int(b * 255))


def adjust_lightness(hex_color: str, amount: float) -> str:
    """
    Adjust the lightness of a color.
    Amount: positive to lighten, negative to darken.
    """
    rgb = hex_to_rgb(hex_color)
    h, s, l = rgb_to_hsl(rgb)
    l = max(0, min(100, l + amount))
    new_rgb = hsl_to_rgb((h, s, l))
    return rgb_to_hex(new_rgb)


def generate_shades(hex_color: str, steps: int = 9) -> Dict[str, str]:
    """Generate color shades from 50 (lightest) to 900 (darkest)."""
    shades = {}
    scale = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

    # Middle shade (500) is the base color
    shades[500] = hex_color

    # Generate lighter shades (50-400)
    for i, shade in enumerate(scale[:5]):
        if shade == 500:
            continue
        lightness_adjustment = (5 - i) * 12  # Adjust by 12% for each step
        shades[shade] = adjust_lightness(hex_color, lightness_adjustment)

    # Generate darker shades (600-900)
    for i, shade in enumerate(scale[5:]):
        if shade == 500:
            continue
        lightness_adjustment = -(i + 1) * 8  # Adjust by -8% for each step
        shades[shade] = adjust_lightness(hex_color, lightness_adjustment)

    return shades


def get_relative_luminance(rgb: Tuple[int, int, int]) -> float:
    """Calculate relative luminance for contrast ratio."""
    def adjust(val):
        val = val / 255.0
        return val / 12.92 if val <= 0.03928 else ((val + 0.055) / 1.055) ** 2.4

    r, g, b = [adjust(x) for x in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(color1: str, color2: str) -> float:
    """Calculate WCAG contrast ratio between two colors."""
    lum1 = get_relative_luminance(hex_to_rgb(color1))
    lum2 = get_relative_luminance(hex_to_rgb(color2))

    lighter = max(lum1, lum2)
    darker = min(lum1, lum2)

    return (lighter + 0.05) / (darker + 0.05)


def check_wcag_compliance(ratio: float) -> Dict[str, Dict[str, bool]]:
    """Check WCAG AA and AAA compliance."""
    return {
        'AA': {
            'normal_text': ratio >= 4.5,
            'large_text': ratio >= 3.0,
        },
        'AAA': {
            'normal_text': ratio >= 7.0,
            'large_text': ratio >= 4.5,
        }
    }


def generate_opacity_variants(hex_color: str) -> Dict[str, str]:
    """Generate opacity variants of a color."""
    rgb = hex_to_rgb(hex_color)
    opacities = {
        10: 0.1,
        20: 0.2,
        30: 0.3,
        40: 0.4,
        50: 0.5,
        60: 0.6,
        70: 0.7,
        80: 0.8,
        90: 0.9,
    }

    return {
        f'{percent}': f'rgba({rgb[0]}, {rgb[1]}, {rgb[2]}, {opacity})'
        for percent, opacity in opacities.items()
    }


def output_javascript(color_name: str, base_color: str) -> str:
    """Generate JavaScript color configuration."""
    shades = generate_shades(base_color)
    opacities = generate_opacity_variants(base_color)

    js_code = f"""// {color_name.title()} Color Palette
export const {color_name}Colors = {{
  DEFAULT: '{base_color}',

  // Shades
"""

    for shade, color in sorted(shades.items()):
        js_code += f"  {shade}: '{color}',\n"

    js_code += "\n  // Opacity Variants\n  opacity: {\n"
    for percent, rgba in opacities.items():
        js_code += f"    {percent}: '{rgba}',\n"
    js_code += "  },\n};\n"

    return js_code


def output_css(color_name: str, base_color: str) -> str:
    """Generate CSS custom properties."""
    shades = generate_shades(base_color)
    opacities = generate_opacity_variants(base_color)

    css_code = f"""/* {color_name.title()} Color Palette */
:root {{
  --{color_name}: {base_color};

  /* Shades */
"""

    for shade, color in sorted(shades.items()):
        css_code += f"  --{color_name}-{shade}: {color};\n"

    css_code += "\n  /* Opacity Variants */\n"
    for percent, rgba in opacities.items():
        css_code += f"  --{color_name}-opacity-{percent}: {rgba};\n"
    css_code += "}\n"

    return css_code


def output_json(color_name: str, base_color: str) -> str:
    """Generate JSON color configuration."""
    shades = generate_shades(base_color)
    opacities = generate_opacity_variants(base_color)

    data = {
        color_name: {
            "default": base_color,
            "shades": shades,
            "opacity": opacities,
        }
    }

    return json.dumps(data, indent=2)


def output_tailwind(color_name: str, base_color: str) -> str:
    """Generate Tailwind config color object."""
    shades = generate_shades(base_color)

    tw_code = f"""// Add to tailwind.config.js theme.extend.colors
{color_name}: {{
  DEFAULT: '{base_color}',
"""

    for shade, color in sorted(shades.items()):
        tw_code += f"  {shade}: '{color}',\n"

    tw_code += "},\n"

    return tw_code


def test_contrast_ratios(base_color: str, backgrounds: List[str]) -> str:
    """Test contrast ratios against multiple backgrounds."""
    output = f"\nContrast Ratio Tests for {base_color}\n"
    output += "=" * 60 + "\n\n"

    for bg in backgrounds:
        ratio = contrast_ratio(base_color, bg)
        compliance = check_wcag_compliance(ratio)

        output += f"Against {bg}:\n"
        output += f"  Contrast Ratio: {ratio:.2f}:1\n"
        output += f"  WCAG AA Normal Text: {'✓' if compliance['AA']['normal_text'] else '✗'}\n"
        output += f"  WCAG AA Large Text: {'✓' if compliance['AA']['large_text'] else '✗'}\n"
        output += f"  WCAG AAA Normal Text: {'✓' if compliance['AAA']['normal_text'] else '✗'}\n"
        output += f"  WCAG AAA Large Text: {'✓' if compliance['AAA']['large_text'] else '✗'}\n"
        output += "\n"

    return output


def main():
    parser = argparse.ArgumentParser(
        description='Generate color palettes and test contrast ratios'
    )
    parser.add_argument(
        '--color',
        help='Base color in hex format (e.g., #0b6d41)',
        required=False
    )
    parser.add_argument(
        '--name',
        default='primary',
        help='Color name (default: primary)'
    )
    parser.add_argument(
        '--format',
        choices=['js', 'css', 'json', 'tailwind', 'all'],
        default='js',
        help='Output format (default: js)'
    )
    parser.add_argument(
        '--output',
        help='Output file path (optional, prints to stdout if not specified)'
    )
    parser.add_argument(
        '--test-contrast',
        nargs=2,
        metavar=('COLOR', 'BACKGROUND'),
        help='Test contrast ratio between two colors'
    )
    parser.add_argument(
        '--test-backgrounds',
        nargs='+',
        default=['#ffffff', '#000000', '#fbfbee'],
        help='Test contrast against multiple backgrounds'
    )

    args = parser.parse_args()

    # Test contrast mode
    if args.test_contrast:
        color1, color2 = args.test_contrast
        ratio = contrast_ratio(color1, color2)
        compliance = check_wcag_compliance(ratio)

        print(f"\nContrast Ratio: {ratio:.2f}:1")
        print(f"\nWCAG AA Compliance:")
        print(f"  Normal Text (4.5:1): {'✓ Pass' if compliance['AA']['normal_text'] else '✗ Fail'}")
        print(f"  Large Text (3:1): {'✓ Pass' if compliance['AA']['large_text'] else '✗ Fail'}")
        print(f"\nWCAG AAA Compliance:")
        print(f"  Normal Text (7:1): {'✓ Pass' if compliance['AAA']['normal_text'] else '✗ Fail'}")
        print(f"  Large Text (4.5:1): {'✓ Pass' if compliance['AAA']['large_text'] else '✗ Fail'}")
        return

    # Generate palette mode
    if not args.color:
        parser.error('--color is required when not using --test-contrast')

    base_color = args.color.strip()
    if not base_color.startswith('#'):
        base_color = '#' + base_color

    # Generate output based on format
    output_functions = {
        'js': output_javascript,
        'css': output_css,
        'json': output_json,
        'tailwind': output_tailwind,
    }

    if args.format == 'all':
        result = ""
        for fmt in ['js', 'css', 'json', 'tailwind']:
            result += f"\n{'='*60}\n"
            result += f"{fmt.upper()} Format\n"
            result += f"{'='*60}\n\n"
            result += output_functions[fmt](args.name, base_color)
            result += "\n"

        # Add contrast tests
        result += "\n" + test_contrast_ratios(base_color, args.test_backgrounds)
    else:
        result = output_functions[args.format](args.name, base_color)

        # Add contrast tests for all formats
        result += "\n" + test_contrast_ratios(base_color, args.test_backgrounds)

    # Output to file or stdout
    if args.output:
        with open(args.output, 'w') as f:
            f.write(result)
        print(f"Color palette written to {args.output}")
    else:
        print(result)


if __name__ == '__main__':
    main()
