/**
 * Convert SVG icons to PNG format for Android TWA
 *
 * Generates PNG icons at required sizes:
 * - 192x192 (standard icon)
 * - 512x512 (high-res launcher icon)
 * - Maskable icons with safe area padding
 */

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SIZES = [192, 512];

// Safe area for maskable icons (20% padding)
const MASKABLE_SAFE_AREA = 0.2;

async function convertSvgToPng(svgPath, outputPath, size, isMaskable = false) {
  try {
    let svgContent = fs.readFileSync(svgPath, 'utf-8');

    // For maskable icons, add padding
    if (isMaskable) {
      const padding = size * MASKABLE_SAFE_AREA;
      const innerSize = size - (padding * 2);

      // Wrap SVG with padding
      svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
          <rect width="${size}" height="${size}" fill="#3b82f6"/>
          <g transform="translate(${padding}, ${padding}) scale(${innerSize / 512})">
            ${svgContent.replace(/<svg[^>]*>/, '').replace('</svg>', '')}
          </g>
        </svg>
      `;
    }

    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: size,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`✅ Created: ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`❌ Error converting ${svgPath}:`, error.message);
  }
}

async function main() {
  console.log('🎨 Converting SVG icons to PNG for Android TWA...\n');

  const svgIcon = path.join(ICONS_DIR, 'icon.svg');

  if (!fs.existsSync(svgIcon)) {
    console.error('❌ Error: icon.svg not found in public/icons');
    process.exit(1);
  }

  // Convert to standard PNG icons
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}.png`);
    await convertSvgToPng(svgIcon, outputPath, size, false);
  }

  // Convert to maskable icons with safe area
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}x${size}-maskable.png`);
    await convertSvgToPng(svgIcon, outputPath, size, true);
  }

  console.log('\n✨ Icon conversion complete!');
  console.log('\nGenerated files:');
  console.log('  - icon-192x192.png (standard)');
  console.log('  - icon-512x512.png (standard)');
  console.log('  - icon-192x192-maskable.png (adaptive with safe area)');
  console.log('  - icon-512x512-maskable.png (adaptive with safe area)');
}

main().catch(console.error);
